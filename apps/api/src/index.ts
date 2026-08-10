import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@trace/config";
import { AppError, createLogger, isAppError } from "@trace/shared";
import { resolveApiKey, resolveSession, sessionCookieName } from "./auth.js";
import { createQueues } from "./queue.js";
import { authRoutes, projectRoutes } from "./routes/auth-projects.js";
import {
  dataRoutes,
  investigationRoutes,
  jobsRoutes,
  scanRoutes,
  sseRoutes,
  webhookAndKeyRoutes,
} from "./routes/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root when running from apps/api
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
} catch {
  // ignore
}

const env = loadEnv(process.env);
const log = createLogger("api", env.LOG_LEVEL);

async function main() {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_000_000,
    trustProxy: true,
    genReqId: () => randomUUID(),
  });

  await app.register(cors, {
    origin: env.APP_URL,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });

  app.decorateRequest("requestId", "");
  app.decorateRequest("user", undefined);

  app.addHook("onRequest", async (req) => {
    req.requestId = (req.id as string) || randomUUID();
    const cookieToken = req.cookies[sessionCookieName()];
    const sessionUser = await resolveSession(cookieToken);
    const apiUser = sessionUser ? null : await resolveApiKey(req.headers.authorization);
    req.user = sessionUser || apiUser || undefined;
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof Error && "validation" in err) {
      reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: err.message,
          requestId: req.requestId,
        },
      });
      return;
    }
    if (isAppError(err)) {
      reply.status(err.status).send({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId: req.requestId,
        },
      });
      return;
    }
    log.error("unhandled error", { error: err, requestId: req.requestId });
    reply.status(500).send({
      error: {
        code: "INTERNAL",
        message: "Unexpected server error.",
        requestId: req.requestId,
      },
    });
  });

  const queues = createQueues(env.REDIS_URL);

  // Bridge worker progress → SSE clients
  const { getRedis } = await import("./queue.js");
  const { publishRealtime } = await import("./realtime.js");
  const sub = getRedis(env.REDIS_URL).duplicate();
  await sub.subscribe("trace:realtime");
  sub.on("message", (_channel, message) => {
    try {
      const parsed = JSON.parse(message) as {
        userId: string;
        projectId?: string;
        event: string;
        data: Record<string, unknown>;
      };
      publishRealtime({
        event: parsed.event,
        userId: parsed.userId,
        projectId: parsed.projectId,
        data: parsed.data || {},
      });
    } catch {
      // ignore malformed
    }
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "trace-api",
    time: new Date().toISOString(),
  }));

  await authRoutes(app, { cookieSecure: !!env.COOKIE_SECURE });
  await projectRoutes(app);
  await scanRoutes(app, queues);
  await dataRoutes(app);
  await investigationRoutes(app, queues);
  await webhookAndKeyRoutes(app);
  await jobsRoutes(app);
  await sseRoutes(app);

  // OAuth placeholder
  app.get("/api/auth/oauth/:provider", async () => {
    throw new AppError(
      "OAUTH_UNAVAILABLE",
      "OAuth providers are architected but not enabled yet. Use email/password auth.",
      501,
    );
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  log.info("API listening", { port: env.API_PORT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
