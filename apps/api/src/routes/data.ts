import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@trace/database";
import {
  AppError,
  generateApiKey,
  generateToken,
  maskApiKey,
  validatePublicHttpUrl,
} from "@trace/shared";
import { requireProjectOwned, requireUser } from "../auth.js";
import type { TraceQueues } from "../queue.js";
import { subscribeSse } from "../realtime.js";

export async function scanRoutes(app: FastifyInstance, queues: TraceQueues) {
  app.post("/api/projects/:id/scan", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const project = await requireProjectOwned(user.id, id);
    if (project.status === "paused") {
      throw new AppError("PROJECT_PAUSED", "Resume monitoring before scanning.", 400);
    }

    await db.project.update({ where: { id }, data: { status: "scanning" } });

    const jobRecord = await db.jobRecord.create({
      data: {
        projectId: id,
        queueName: "trace-scans",
        type: "SCAN_PROJECT",
        status: "queued",
        payload: { projectId: id, userId: user.id },
        maxAttempts: 5,
      },
    });

    const job = await queues.scans.add(
      "SCAN_PROJECT",
      { projectId: id, userId: user.id, jobRecordId: jobRecord.id },
      {
        jobId: `scan-${id}-${Date.now()}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    await db.jobRecord.update({
      where: { id: jobRecord.id },
      data: { bullJobId: String(job.id) },
    });

    return { jobId: jobRecord.id, bullJobId: job.id, status: "queued" };
  });
}

export async function dataRoutes(app: FastifyInstance) {
  app.get("/api/projects/:id/pages", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    await requireProjectOwned(user.id, id);
    const pages = await db.page.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { snapshots: true, changes: true } } },
    });
    return { items: pages };
  });

  app.get("/api/projects/:id/timeline", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    await requireProjectOwned(user.id, id);
    const events = await db.event.findMany({
      where: { projectId: id },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: { change: true },
    });
    return { items: events };
  });

  app.get("/api/projects/:id/changes", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    await requireProjectOwned(user.id, id);
    const q = req.query as { type?: string; page?: string; pageSize?: string };
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize || 20)));
    const where = {
      projectId: id,
      ...(q.type ? { type: q.type as never } : {}),
    };
    const [total, items] = await Promise.all([
      db.change.count({ where }),
      db.change.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { page: true },
      }),
    ]);
    return { items, total, page, pageSize, hasMore: page * pageSize < total };
  });

  app.get("/api/changes/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const change = await db.change.findUnique({
      where: { id },
      include: {
        page: true,
        project: true,
        previousSnapshot: true,
        currentSnapshot: true,
        evidence: true,
      },
    });
    if (!change || change.project.userId !== user.id) {
      throw new AppError("NOT_FOUND", "Change not found.", 404);
    }
    return { change };
  });

  app.get("/api/pages/:id/snapshots", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const page = await db.page.findUnique({ where: { id }, include: { project: true } });
    if (!page || page.project.userId !== user.id) throw new AppError("NOT_FOUND", "Page not found.", 404);
    const snapshots = await db.snapshot.findMany({
      where: { pageId: id },
      orderBy: { fetchedAt: "desc" },
      take: 100,
      select: {
        id: true,
        url: true,
        fetchedAt: true,
        statusCode: true,
        title: true,
        contentHash: true,
        contentType: true,
      },
    });
    return { items: snapshots };
  });

  app.get("/api/pages/:id/compare", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const q = z
      .object({ a: z.string(), b: z.string() })
      .parse(req.query);
    const page = await db.page.findUnique({ where: { id }, include: { project: true } });
    if (!page || page.project.userId !== user.id) throw new AppError("NOT_FOUND", "Page not found.", 404);
    const [a, b] = await Promise.all([
      db.snapshot.findFirst({ where: { id: q.a, pageId: id } }),
      db.snapshot.findFirst({ where: { id: q.b, pageId: id } }),
    ]);
    if (!a || !b) throw new AppError("NOT_FOUND", "Snapshots not found.", 404);
    return {
      a: { id: a.id, fetchedAt: a.fetchedAt, title: a.title, normalizedContent: a.normalizedContent },
      b: { id: b.id, fetchedAt: b.fetchedAt, title: b.title, normalizedContent: b.normalizedContent },
    };
  });

  app.get("/api/search", async (req) => {
    const user = await requireUser(req);
    const q = z.object({ q: z.string().min(1), projectId: z.string().optional() }).parse(req.query);
    const projectFilter = q.projectId
      ? { id: q.projectId, userId: user.id }
      : { userId: user.id };
    const projects = await db.project.findMany({ where: projectFilter, select: { id: true } });
    const ids = projects.map((p) => p.id);
    if (!ids.length) return { pages: [], snapshots: [], changes: [], events: [] };

    const term = q.q;
    const [pages, snapshots, changes, events] = await Promise.all([
      db.page.findMany({
        where: {
          projectId: { in: ids },
          OR: [{ url: { contains: term, mode: "insensitive" } }, { title: { contains: term, mode: "insensitive" } }],
        },
        take: 20,
      }),
      db.snapshot.findMany({
        where: {
          projectId: { in: ids },
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { normalizedContent: { contains: term, mode: "insensitive" } },
          ],
        },
        take: 20,
        orderBy: { fetchedAt: "desc" },
        select: { id: true, url: true, title: true, fetchedAt: true, projectId: true, pageId: true },
      }),
      db.change.findMany({
        where: {
          projectId: { in: ids },
          OR: [{ summary: { contains: term, mode: "insensitive" } }, { type: { equals: term.toUpperCase() as never } }],
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      db.event.findMany({
        where: {
          projectId: { in: ids },
          OR: [{ title: { contains: term, mode: "insensitive" } }, { type: { contains: term, mode: "insensitive" } }],
        },
        take: 20,
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    return { pages, snapshots, changes, events };
  });

  app.get("/api/projects/:id/graph", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    await requireProjectOwned(user.id, id);
    const [entities, edges] = await Promise.all([
      db.graphEntity.findMany({ where: { projectId: id } }),
      db.graphEdge.findMany({ where: { projectId: id } }),
    ]);
    return { entities, edges };
  });
}

export async function investigationRoutes(app: FastifyInstance, queues: TraceQueues) {
  app.post("/api/investigations", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req) => {
    const user = await requireUser(req);
    const body = z
      .object({
        question: z.string().min(3).max(500),
        projectId: z.string().optional(),
        changeId: z.string().optional(),
      })
      .parse(req.body);

    if (body.projectId) await requireProjectOwned(user.id, body.projectId);

    const investigation = await db.investigation.create({
      data: {
        userId: user.id,
        projectId: body.projectId,
        question: body.question,
        status: "pending",
      },
    });

    const jobRecord = await db.jobRecord.create({
      data: {
        projectId: body.projectId,
        queueName: "trace-investigations",
        type: "RUN_INVESTIGATION",
        status: "queued",
        payload: {
          investigationId: investigation.id,
          changeId: body.changeId,
          userId: user.id,
        },
      },
    });

    const job = await queues.investigations.add(
      "RUN_INVESTIGATION",
      {
        investigationId: investigation.id,
        changeId: body.changeId,
        userId: user.id,
        jobRecordId: jobRecord.id,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 1500 } },
    );

    await db.jobRecord.update({
      where: { id: jobRecord.id },
      data: { bullJobId: String(job.id) },
    });

    return { investigation, jobId: jobRecord.id };
  });

  app.get("/api/investigations", async (req) => {
    const user = await requireUser(req);
    const items = await db.investigation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { evidence: true, project: { select: { id: true, name: true } } },
    });
    return { items };
  });

  app.get("/api/investigations/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const investigation = await db.investigation.findFirst({
      where: { id, userId: user.id },
      include: { evidence: true, project: true },
    });
    if (!investigation) throw new AppError("NOT_FOUND", "Investigation not found.", 404);
    return { investigation };
  });
}

export async function webhookAndKeyRoutes(app: FastifyInstance) {
  app.get("/api/webhooks", async (req) => {
    const user = await requireUser(req);
    const items = await db.webhook.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveries: true } } },
    });
    return {
      items: items.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        createdAt: w.createdAt,
        deliveries: w._count.deliveries,
      })),
    };
  });

  app.post("/api/webhooks", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req) => {
    const user = await requireUser(req);
    const body = z
      .object({
        url: z.string().url(),
        events: z.array(z.string()).min(1),
      })
      .parse(req.body);
    const v = validatePublicHttpUrl(body.url);
    if (!v.ok) throw new AppError("INVALID_URL", v.reason || "Invalid webhook URL", 400);
    const secret = generateToken(24);
    const webhook = await db.webhook.create({
      data: {
        userId: user.id,
        url: v.normalized!,
        events: body.events,
        secret,
      },
    });
    return { webhook: { id: webhook.id, url: webhook.url, events: webhook.events, secret } };
  });

  app.delete("/api/webhooks/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const existing = await db.webhook.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new AppError("NOT_FOUND", "Webhook not found.", 404);
    await db.webhook.delete({ where: { id } });
    return { ok: true };
  });

  app.get("/api/webhooks/:id/deliveries", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const existing = await db.webhook.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new AppError("NOT_FOUND", "Webhook not found.", 404);
    const items = await db.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });

  app.get("/api/api-keys", async (req) => {
    const user = await requireUser(req);
    const items = await db.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      items: items.map((k) => ({
        id: k.id,
        name: k.name,
        masked: maskApiKey(k.prefix),
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
      })),
    };
  });

  app.post("/api/api-keys", async (req) => {
    const user = await requireUser(req);
    const body = z.object({ name: z.string().min(1).max(80) }).parse(req.body);
    const generated = generateApiKey();
    const key = await db.apiKey.create({
      data: {
        userId: user.id,
        name: body.name,
        prefix: generated.prefix,
        keyHash: generated.hash,
      },
    });
    return {
      apiKey: {
        id: key.id,
        name: key.name,
        raw: generated.raw,
        masked: maskApiKey(generated.prefix),
      },
    };
  });

  app.delete("/api/api-keys/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const existing = await db.apiKey.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new AppError("NOT_FOUND", "API key not found.", 404);
    await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  });
}

export async function jobsRoutes(app: FastifyInstance) {
  app.get("/api/jobs", async (req) => {
    const user = await requireUser(req);
    const projects = await db.project.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = projects.map((p) => p.id);
    const items = await db.jobRecord.findMany({
      where: { OR: [{ projectId: { in: ids } }, { payload: { path: ["userId"], equals: user.id } }] },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items };
  });
}

export async function sseRoutes(app: FastifyInstance) {
  app.get("/api/events/stream", async (req, reply) => {
    const user = await requireUser(req);
    const projectId = (req.query as { projectId?: string }).projectId;

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Credentials": "true",
    });
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const unsubscribe = subscribeSse({
      userId: user.id,
      projectId,
      write: (chunk) => reply.raw.write(chunk),
      close: () => reply.raw.end(),
    });

    const keepAlive = setInterval(() => {
      reply.raw.write(`: ping\n\n`);
    }, 15000);

    req.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });
}
