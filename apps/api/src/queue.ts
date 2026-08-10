import { Queue } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAMES = {
  scans: "trace-scans",
  pages: "trace-pages",
  webhooks: "trace-webhooks",
  investigations: "trace-investigations",
} as const;

let connection: IORedis | null = null;

export function getRedis(redisUrl: string) {
  if (!connection) {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function createQueues(redisUrl: string) {
  const conn = getRedis(redisUrl);
  return {
    scans: new Queue(QUEUE_NAMES.scans, { connection: conn }),
    pages: new Queue(QUEUE_NAMES.pages, { connection: conn }),
    webhooks: new Queue(QUEUE_NAMES.webhooks, { connection: conn }),
    investigations: new Queue(QUEUE_NAMES.investigations, { connection: conn }),
  };
}

export type TraceQueues = ReturnType<typeof createQueues>;
