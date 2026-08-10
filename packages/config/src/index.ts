import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SESSION_SECRET: z.string().min(16),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  API_PORT: z.coerce.number().default(4000),
  AI_API_KEY: z.string().optional().default(""),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_PROVIDER: z.enum(["openai", "openrouter"]).default("openai"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_SECRET_KEY: z.string().optional().default(""),
  STORAGE_REGION: z.string().default("us-east-1"),
  CRAWL_MAX_DEPTH: z.coerce.number().default(2),
  CRAWL_MAX_PAGES: z.coerce.number().default(25),
  CRAWL_CONCURRENCY: z.coerce.number().default(3),
  CRAWL_TIMEOUT_MS: z.coerce.number().default(30000),
  CRAWL_RESPECT_ROBOTS: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  DEMO_SITE_URL: z.string().default("http://localhost:3000/demo-site"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type TraceEnv = z.infer<typeof envSchema>;

let cached: TraceEnv | null = null;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): TraceEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
