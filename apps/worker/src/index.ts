import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { loadEnv } from "@trace/config";
import { crawlSite } from "@trace/crawler";
import { db } from "@trace/database";
import { classifySemanticChange, computeRawDiff } from "@trace/diff-engine";
import {
  createAiProvider,
  heuristicInvestigation,
  runInvestigation,
  type EvidenceItem,
} from "@trace/ai";
import { contentHash, createLogger, signWebhookPayload } from "@trace/shared";
import { mkdir, writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
} catch {
  // ignore
}

const env = loadEnv(process.env);
const log = createLogger("worker", env.LOG_LEVEL);
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

async function putRaw(html: string, hash: string) {
  const key = path.join("raw", hash.slice(0, 2), `${hash}.html`);
  const full = path.resolve(env.STORAGE_LOCAL_PATH, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, html, "utf8");
  return key.replace(/\\/g, "/");
}

async function markJob(
  jobRecordId: string | undefined,
  data: {
    status?: "queued" | "running" | "completed" | "failed" | "retrying" | "dead";
    attempts?: number;
    reason?: string;
    result?: unknown;
    nextRetryAt?: Date | null;
  },
) {
  if (!jobRecordId) return;
  await db.jobRecord.update({
    where: { id: jobRecordId },
    data: {
      ...data,
      ...(data.status === "completed" ? { completedAt: new Date() } : {}),
      updatedAt: new Date(),
    },
  });
}

/** Lightweight pub via Redis pub/sub channel consumed by API process optionally; also write Event rows */
async function emitProgress(userId: string, projectId: string, event: string, data: Record<string, unknown>) {
  await connection.publish(
    "trace:realtime",
    JSON.stringify({ userId, projectId, event, data, at: new Date().toISOString() }),
  );
}

async function upsertGraphFromChange(projectId: string, change: {
  id: string;
  type: string;
  summary: string;
  pageUrl: string;
}) {
  const company = await db.graphEntity.upsert({
    where: { projectId_type_name: { projectId, type: "Company", name: "Monitored site" } },
    create: { projectId, type: "Company", name: "Monitored site" },
    update: {},
  });
  const pageEntity = await db.graphEntity.upsert({
    where: { projectId_type_name: { projectId, type: "Page", name: change.pageUrl } },
    create: { projectId, type: "Page", name: change.pageUrl, metadata: { url: change.pageUrl } },
    update: {},
  });
  const changeEntity = await db.graphEntity.upsert({
    where: { projectId_type_name: { projectId, type: "Change", name: `${change.type}:${change.id}` } },
    create: {
      projectId,
      type: "Change",
      name: `${change.type}:${change.id}`,
      metadata: { summary: change.summary, changeId: change.id },
    },
    update: { metadata: { summary: change.summary, changeId: change.id } },
  });

  await db.graphEdge.upsert({
    where: {
      projectId_fromEntityId_toEntityId_type: {
        projectId,
        fromEntityId: company.id,
        toEntityId: pageEntity.id,
        type: "OWNS",
      },
    },
    create: { projectId, fromEntityId: company.id, toEntityId: pageEntity.id, type: "OWNS" },
    update: {},
  });
  await db.graphEdge.upsert({
    where: {
      projectId_fromEntityId_toEntityId_type: {
        projectId,
        fromEntityId: pageEntity.id,
        toEntityId: changeEntity.id,
        type: "CHANGED",
      },
    },
    create: { projectId, fromEntityId: pageEntity.id, toEntityId: changeEntity.id, type: "CHANGED" },
    update: {},
  });

  if (change.type === "PRICE_CHANGE" || change.type.includes("FEATURE")) {
    const plan = await db.graphEntity.upsert({
      where: { projectId_type_name: { projectId, type: "PricingPlan", name: "Detected plan changes" } },
      create: { projectId, type: "PricingPlan", name: "Detected plan changes" },
      update: {},
    });
    await db.graphEdge.upsert({
      where: {
        projectId_fromEntityId_toEntityId_type: {
          projectId,
          fromEntityId: company.id,
          toEntityId: plan.id,
          type: "HAS_FEATURE",
        },
      },
      create: { projectId, fromEntityId: company.id, toEntityId: plan.id, type: "HAS_FEATURE" },
      update: {},
    });
  }
}

async function enqueueWebhooks(userId: string, event: string, payload: Record<string, unknown>) {
  const hooks = await db.webhook.findMany({
    where: { userId, active: true, events: { has: event } },
  });
  for (const hook of hooks) {
    await webhookQueue.add(
      "DELIVER_WEBHOOK",
      { webhookId: hook.id, event, payload },
      { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
    );
  }
}

async function processScan(data: { projectId: string; userId: string; jobRecordId?: string }) {
  const started = Date.now();
  await markJob(data.jobRecordId, { status: "running", attempts: 1 });
  await emitProgress(data.userId, data.projectId, "scan.started", { projectId: data.projectId });

  const project = await db.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new Error("Project not found");

  const allowLocalDemo =
    project.rootUrl.includes("/demo-site") &&
    (project.rootUrl.includes("localhost") || project.rootUrl.includes("127.0.0.1"));

  let changesDetected = 0;
  let pagesScanned = 0;

  try {
    const pages = await crawlSite({
      rootUrl: project.rootUrl,
      maxDepth: project.crawlDepth,
      maxPages: project.pageLimit,
      concurrency: env.CRAWL_CONCURRENCY,
      timeoutMs: env.CRAWL_TIMEOUT_MS,
      respectRobots: env.CRAWL_RESPECT_ROBOTS && !allowLocalDemo,
      allowLocalDemo,
      onProgress: async (ev) => {
        await emitProgress(data.userId, data.projectId, ev.type === "scanned" ? "page.scanned" : "page.discovered", {
          ...ev,
        });
      },
    });

    for (const crawled of pages) {
      pagesScanned += 1;
      const page = await db.page.upsert({
        where: { projectId_url: { projectId: project.id, url: crawled.url } },
        create: {
          projectId: project.id,
          url: crawled.url,
          title: crawled.title,
          depth: crawled.depth,
          lastSeenAt: crawled.fetchedAt,
        },
        update: {
          title: crawled.title,
          lastSeenAt: crawled.fetchedAt,
          depth: crawled.depth,
        },
      });

      const normHash = contentHash(crawled.normalizedContent);
      const rawHash = contentHash(crawled.html);
      const rawKey = await putRaw(crawled.html, rawHash);
      await db.contentBlob.upsert({
        where: { contentHash: rawHash },
        create: { contentHash: rawHash, size: Buffer.byteLength(crawled.html), storageKey: rawKey },
        update: {},
      });

      const previous = await db.snapshot.findFirst({
        where: { pageId: page.id },
        orderBy: { fetchedAt: "desc" },
      });

      // Skip identical normalized content — avoid duplicate snapshots
      if (previous && previous.contentHash === normHash) {
        continue;
      }

      const snapshot = await db.snapshot.create({
        data: {
          projectId: project.id,
          pageId: page.id,
          url: crawled.url,
          fetchedAt: crawled.fetchedAt,
          statusCode: crawled.statusCode,
          contentType: crawled.contentType,
          title: crawled.title,
          normalizedContent: crawled.normalizedContent,
          contentHash: normHash,
          rawStorageKey: rawKey,
          metadata: crawled.metadata,
        },
      });

      if (previous) {
        const semantic = classifySemanticChange(previous.normalizedContent, snapshot.normalizedContent);
        const raw = computeRawDiff(previous.normalizedContent, snapshot.normalizedContent);
        const change = await db.change.create({
          data: {
            projectId: project.id,
            pageId: page.id,
            previousSnapshotId: previous.id,
            currentSnapshotId: snapshot.id,
            type: semantic.type,
            severity: semantic.severity,
            summary: semantic.summary,
            confidence: semantic.confidence,
            rawDiff: raw,
            semanticDiff: semantic,
          },
        });
        changesDetected += 1;

        await db.event.create({
          data: {
            projectId: project.id,
            changeId: change.id,
            title: semantic.summary,
            type: semantic.type,
            occurredAt: snapshot.fetchedAt,
            metadata: { pageUrl: crawled.url, severity: semantic.severity },
          },
        });

        await upsertGraphFromChange(project.id, {
          id: change.id,
          type: change.type,
          summary: change.summary,
          pageUrl: crawled.url,
        });

        await emitProgress(data.userId, data.projectId, "change.detected", {
          changeId: change.id,
          type: change.type,
          summary: change.summary,
          url: crawled.url,
        });

        const webhookEvent =
          change.type === "PRICE_CHANGE"
            ? "pricing.changed"
            : change.type === "FEATURE_ADDED"
              ? "feature.added"
              : change.type === "FEATURE_REMOVED"
                ? "feature.removed"
                : "page.changed";
        await enqueueWebhooks(data.userId, webhookEvent, {
          event: webhookEvent,
          projectId: project.id,
          timestamp: new Date().toISOString(),
          changeId: change.id,
        });
      } else {
        // first snapshot — seed graph page node
        await upsertGraphFromChange(project.id, {
          id: `seed-${page.id}`,
          type: "TECHNICAL_CHANGE",
          summary: "Initial snapshot",
          pageUrl: crawled.url,
        });
      }
    }

    await db.project.update({
      where: { id: project.id },
      data: { status: "active", lastScanAt: new Date() },
    });

    await enqueueWebhooks(data.userId, "project.scan.completed", {
      event: "project.scan.completed",
      projectId: project.id,
      timestamp: new Date().toISOString(),
      pagesScanned,
      changesDetected,
    });

    await emitProgress(data.userId, data.projectId, "scan.completed", {
      pagesScanned,
      changesDetected,
      durationMs: Date.now() - started,
    });

    await markJob(data.jobRecordId, {
      status: "completed",
      result: { pagesScanned, changesDetected, durationMs: Date.now() - started },
    });

    log.info("scan completed", {
      projectId: project.id,
      pagesScanned,
      changesDetected,
      duration: Date.now() - started,
    });
  } catch (err) {
    await db.project.update({
      where: { id: data.projectId },
      data: { status: "error" },
    });
    await emitProgress(data.userId, data.projectId, "scan.failed", {
      message: err instanceof Error ? err.message : "Scan failed",
    });
    await markJob(data.jobRecordId, {
      status: "failed",
      reason: err instanceof Error ? err.message : "Scan failed",
    });
    throw err;
  }
}

async function processInvestigation(data: {
  investigationId: string;
  userId: string;
  changeId?: string;
  jobRecordId?: string;
}) {
  await markJob(data.jobRecordId, { status: "running" });
  const investigation = await db.investigation.findUnique({ where: { id: data.investigationId } });
  if (!investigation) throw new Error("Investigation not found");

  await db.investigation.update({
    where: { id: investigation.id },
    data: { status: "running" },
  });
  await emitProgress(data.userId, investigation.projectId || "", "ai.started", {
    investigationId: investigation.id,
  });

  const projectIds = investigation.projectId
    ? [investigation.projectId]
    : (await db.project.findMany({ where: { userId: data.userId }, select: { id: true } })).map((p) => p.id);

  const tokens = investigation.question
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2)
    .slice(0, 8);

  const changes = await db.change.findMany({
    where: {
      projectId: { in: projectIds },
      OR: [
        ...(data.changeId ? [{ id: data.changeId }] : []),
        ...tokens.map((t) => ({ summary: { contains: t, mode: "insensitive" as const } })),
        { type: { in: ["PRICE_CHANGE", "FEATURE_ADDED", "FEATURE_REMOVED", "PRODUCT_LAUNCH"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { page: true, currentSnapshot: true, previousSnapshot: true },
  });

  const snapshots = await db.snapshot.findMany({
    where: {
      projectId: { in: projectIds },
      OR: tokens.map((t) => ({ normalizedContent: { contains: t, mode: "insensitive" as const } })),
    },
    orderBy: { fetchedAt: "desc" },
    take: 10,
  });

  const evidenceRows: EvidenceItem[] = [];
  for (const c of changes) {
    const id = `chg_${c.id}`;
    evidenceRows.push({
      id,
      label: `${c.type} on ${c.page.url}`,
      excerpt: `${c.summary}\nPrev: ${c.previousSnapshot?.normalizedContent.slice(0, 280) ?? ""}\nCurr: ${c.currentSnapshot.normalizedContent.slice(0, 280)}`,
      sourceType: "change",
      occurredAt: c.createdAt.toISOString(),
    });
  }
  for (const s of snapshots) {
    const id = `snap_${s.id}`;
    evidenceRows.push({
      id,
      label: `Snapshot ${s.title || s.url}`,
      excerpt: s.normalizedContent.slice(0, 500),
      sourceType: "snapshot",
      occurredAt: s.fetchedAt.toISOString(),
    });
  }

  // Persist evidence
  await db.evidence.deleteMany({ where: { investigationId: investigation.id } });
  for (const [i, e] of evidenceRows.entries()) {
    const changeId = e.id.startsWith("chg_") ? e.id.slice(4) : undefined;
    const snapshotId = e.id.startsWith("snap_") ? e.id.slice(5) : undefined;
    await db.evidence.create({
      data: {
        investigationId: investigation.id,
        changeId,
        snapshotId,
        label: e.label,
        excerpt: e.excerpt,
        rank: 1 - i * 0.03,
      },
    });
  }

  let answer;
  try {
    if (env.AI_API_KEY) {
      const provider = createAiProvider({
        apiKey: env.AI_API_KEY,
        baseUrl: env.AI_BASE_URL,
        model: env.AI_MODEL,
        provider: env.AI_PROVIDER,
      });
      answer = await runInvestigation(provider, investigation.question, evidenceRows);
    } else {
      answer = heuristicInvestigation(investigation.question, evidenceRows);
    }
  } catch (err) {
    log.warn("AI failed, using heuristic", { error: err });
    answer = heuristicInvestigation(investigation.question, evidenceRows);
  }

  await db.investigation.update({
    where: { id: investigation.id },
    data: {
      status: "completed",
      answer,
      confidence: answer.confidence,
    },
  });

  await enqueueWebhooks(data.userId, "investigation.completed", {
    event: "investigation.completed",
    projectId: investigation.projectId,
    timestamp: new Date().toISOString(),
    investigationId: investigation.id,
  });

  await emitProgress(data.userId, investigation.projectId || "", "investigation.completed", {
    investigationId: investigation.id,
    confidence: answer.confidence,
  });
  await markJob(data.jobRecordId, { status: "completed", result: answer });
}

async function processWebhook(data: {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
}) {
  const webhook = await db.webhook.findUnique({ where: { id: data.webhookId } });
  if (!webhook || !webhook.active) return;

  const body = JSON.stringify(data.payload);
  const timestamp = new Date().toISOString();
  const signature = signWebhookPayload(webhook.secret, body, timestamp);

  const delivery = await db.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event: data.event,
      payload: data.payload,
      attempts: 1,
    },
  });

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trace-Event": data.event,
        "X-Trace-Timestamp": timestamp,
        "X-Trace-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: res.status,
        success: res.ok,
        deliveredAt: new Date(),
        lastError: res.ok ? null : `HTTP ${res.status}`,
      },
    });
    if (!res.ok) throw new Error(`Webhook delivery failed: ${res.status}`);
  } catch (err) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        success: false,
        lastError: err instanceof Error ? err.message : "delivery failed",
      },
    });
    throw err;
  }
}

const scanWorker = new Worker(
  "trace-scans",
  async (job) => processScan(job.data),
  { connection, concurrency: 2 },
);

const investigationWorker = new Worker(
  "trace-investigations",
  async (job) => processInvestigation(job.data),
  { connection, concurrency: 2 },
);

const webhookQueueWorker = new Worker(
  "trace-webhooks",
  async (job) => processWebhook(job.data),
  { connection, concurrency: 5 },
);

// Export queue reference for enqueueWebhooks — create after workers
import { Queue } from "bullmq";
const webhookQueue = new Queue("trace-webhooks", { connection });

for (const w of [scanWorker, investigationWorker, webhookQueueWorker]) {
  w.on("failed", async (job, err) => {
    log.error("job failed", { jobId: job?.id, error: err, status: "failed" });
    const jobRecordId = job?.data?.jobRecordId as string | undefined;
    if (jobRecordId) {
      const attempts = job?.attemptsMade ?? 0;
      const max = job?.opts.attempts ?? 5;
      await markJob(jobRecordId, {
        status: attempts >= max ? "dead" : "retrying",
        attempts,
        reason: err.message,
        nextRetryAt: new Date(Date.now() + 2000 * 2 ** attempts),
      });
    }
  });
  w.on("completed", (job) => {
    log.info("job completed", { jobId: job.id, type: job.name });
  });
}

// Bridge Redis pubsub → no-op here; API process can subscribe. For single-box demo,
// also duplicate into a simple in-memory friendly channel by writing AuditLog metrics.
log.info("TRACE worker started", { queues: ["trace-scans", "trace-investigations", "trace-webhooks"] });
