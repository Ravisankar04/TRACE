# Architecture

TRACE is a monorepo with three runtime processes and shared domain packages.

```text
┌────────────┐     rewrite /api/*      ┌────────────┐
│  Next.js   │ ───────────────────────▶│  Fastify   │
│  web :3000 │◀──── SSE / JSON ────────│  api :4000 │
└────────────┘                         └─────┬──────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        ▼                    ▼                    ▼
                   PostgreSQL              Redis              Object store
                                             │               (local/S3 iface)
                                             ▼
                                       BullMQ workers
                                             │
                                             ▼
                                        Playwright
```

## Data flow for a scan

1. `POST /api/projects/:id/scan` creates a `JobRecord` and enqueues `SCAN_PROJECT`.
2. Worker crawls with Playwright (SSRF-checked URLs).
3. HTML is normalized → hashed → stored (deduped by content hash).
4. Previous snapshot compared via raw + semantic classifiers.
5. `Change` + `Event` + graph nodes written.
6. Progress published on Redis `trace:realtime`; API fans out to SSE clients.
7. Matching webhooks enqueued for delivery with HMAC-style signatures.

## Packages

| Package | Responsibility |
| --- | --- |
| `@trace/shared` | Types, SSRF URL validation, hashing, logging |
| `@trace/diff-engine` | Normalization, raw diff, rule classification |
| `@trace/crawler` | Playwright crawl orchestration |
| `@trace/ai` | Provider abstraction + evidence-bound investigation |
| `@trace/database` | Prisma schema/client |
| `@trace/config` | Zod-validated environment |

## Design system

UI tokens are mirrored from the reference product aesthetic (cream app chrome `#FFFAF6`, peach primary `#F2A98C`, Space Grotesk + Inter + Cinzel, `1rem` radii, black cinematic marketing surfaces).
