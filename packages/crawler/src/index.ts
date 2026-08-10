import { createLogger, isSameRegistrableDomain, normalizeUrl, validatePublicHttpUrl } from "@trace/shared";
import { normalizeHtml } from "@trace/diff-engine";
import { chromium, type Browser } from "playwright";
// robots-parser is CJS
import robotsParserImport from "robots-parser";

const robotsParser = robotsParserImport as unknown as (
  url: string,
  contents: string,
) => { isAllowed: (url: string, userAgent?: string) => boolean | undefined };

const log = createLogger("crawler");

export interface CrawlOptions {
  rootUrl: string;
  maxDepth?: number;
  maxPages?: number;
  concurrency?: number;
  timeoutMs?: number;
  respectRobots?: boolean;
  /** Allow demo-site on localhost for local demos only */
  allowLocalDemo?: boolean;
  onProgress?: (event: CrawlProgressEvent) => void | Promise<void>;
}

export interface CrawlProgressEvent {
  type: "discovered" | "scanned" | "skipped" | "error";
  url: string;
  depth?: number;
  statusCode?: number;
  message?: string;
  pagesScanned?: number;
  pagesDiscovered?: number;
}

export interface CrawledPage {
  url: string;
  depth: number;
  statusCode: number;
  contentType: string | null;
  title: string;
  html: string;
  normalizedContent: string;
  metadata: Record<string, string>;
  links: string[];
  fetchedAt: Date;
}

function assertCrawlableUrl(input: string, allowLocalDemo: boolean): string {
  if (allowLocalDemo) {
    try {
      const u = new URL(input);
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        (u.pathname.startsWith("/demo-site") || u.port === "3000")
      ) {
        return normalizeUrl(u.toString());
      }
    } catch {
      // fall through
    }
  }
  const result = validatePublicHttpUrl(input);
  if (!result.ok || !result.normalized) {
    throw new Error(result.reason || "URL blocked by SSRF protection");
  }
  return result.normalized;
}

async function fetchRobots(origin: string, timeoutMs: number) {
  try {
    const res = await fetch(new URL("/robots.txt", origin), {
      signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)),
    });
    if (!res.ok) return null;
    const body = await res.text();
    return robotsParser(new URL("/robots.txt", origin).toString(), body);
  } catch {
    return null;
  }
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

export async function crawlSite(options: CrawlOptions): Promise<CrawledPage[]> {
  const maxDepth = options.maxDepth ?? 2;
  const maxPages = options.maxPages ?? 25;
  const concurrency = options.concurrency ?? 3;
  const timeoutMs = options.timeoutMs ?? 30000;
  const respectRobots = options.respectRobots ?? true;
  const allowLocalDemo = options.allowLocalDemo ?? false;

  const root = assertCrawlableUrl(options.rootUrl, allowLocalDemo);
  const rootUrl = new URL(root);
  const robots =
    respectRobots && !allowLocalDemo ? await fetchRobots(rootUrl.origin, timeoutMs) : null;

  const queue: Array<{ url: string; depth: number }> = [{ url: root, depth: 0 }];
  const seen = new Set<string>([root]);
  const results: CrawledPage[] = [];

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "TRACEBot/1.0 (+https://trace.dev; research monitoring; respectful crawler)",
      javaScriptEnabled: true,
    });

    const workers = Array.from({ length: concurrency }, async () => {
      while (results.length < maxPages) {
        const next = queue.shift();
        if (!next) return;
        if (results.length >= maxPages) return;

        const { url, depth } = next;
        if (robots && !robots.isAllowed(url, "TRACEBot")) {
          await options.onProgress?.({ type: "skipped", url, message: "Blocked by robots.txt", pagesDiscovered: seen.size, pagesScanned: results.length });
          continue;
        }

        try {
          const page = await withRetries(async () => {
            const p = await context.newPage();
            try {
              const response = await p.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
              // Give JS-heavy pages a short settle window
              await p.waitForTimeout(400);
              const html = await p.content();
              const statusCode = response?.status() ?? 0;
              const contentType = response?.headers()["content-type"] ?? null;
              const normalized = normalizeHtml(html, url);
              return {
                url,
                depth,
                statusCode,
                contentType,
                title: normalized.title,
                html,
                normalizedContent: normalized.normalizedContent,
                metadata: normalized.metadata,
                links: normalized.links,
                fetchedAt: new Date(),
              } satisfies CrawledPage;
            } finally {
              await p.close();
            }
          });

          results.push(page);
          await options.onProgress?.({
            type: "scanned",
            url,
            depth,
            statusCode: page.statusCode,
            pagesDiscovered: seen.size,
            pagesScanned: results.length,
          });

          if (depth < maxDepth) {
            for (const link of page.links) {
              if (results.length + queue.length >= maxPages) break;
              if (!isSameRegistrableDomain(root, link)) continue;
              let normalizedLink: string;
              try {
                normalizedLink = assertCrawlableUrl(link, allowLocalDemo);
              } catch {
                continue;
              }
              if (seen.has(normalizedLink)) continue;
              seen.add(normalizedLink);
              queue.push({ url: normalizedLink, depth: depth + 1 });
              await options.onProgress?.({
                type: "discovered",
                url: normalizedLink,
                depth: depth + 1,
                pagesDiscovered: seen.size,
                pagesScanned: results.length,
              });
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Crawl failed";
          log.warn("page crawl failed", { error: err, url });
          await options.onProgress?.({ type: "error", url, message, pagesDiscovered: seen.size, pagesScanned: results.length });
        }
      }
    });

    await Promise.all(workers);
    await context.close();
  } finally {
    await browser?.close();
  }

  return results;
}
