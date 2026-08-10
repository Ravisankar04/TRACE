# TRACE

**Temporal Web Intelligence Engine**

> See how the internet changes.

TRACE continuously monitors websites, stores historical snapshots, detects meaningful changes, reconstructs website history, and explains those changes with **evidence-backed** AI investigations.

This is a portfolio-grade full-stack system — not a fake SaaS wrapper. Every metric, timeline event, diff, and investigation claim is produced by real crawls, real storage, and real analysis.

## Tagline

**Monitor. Remember. Investigate.**

## Why it exists

The public web is mutable. Pricing pages change overnight. Policies quietly rewrite. Features appear and disappear. TRACE treats websites like versioned artifacts: crawl → normalize → fingerprint → diff → classify → investigate.

## Tech stack

| Layer | Choice |
| --- | --- |
| Web | Next.js, TypeScript, Tailwind, TanStack Query, Framer Motion |
| API | Node.js, Fastify, REST, SSE |
| Workers | BullMQ + Redis |
| DB | PostgreSQL + Prisma |
| Crawl | Playwright |
| AI | OpenAI / OpenRouter compatible provider abstraction |
| Storage | Local filesystem (S3-compatible interface ready) |
| Infra | Docker Compose, GitHub Actions |

## Monorepo layout

```text
trace/
├── apps/
│   ├── web/       # Next.js UI (SLY-matched design system)
│   ├── api/       # Fastify REST + SSE
│   └── worker/    # BullMQ consumers
├── packages/
│   ├── database/  # Prisma schema + client
│   ├── crawler/   # Playwright crawler + SSRF guards
│   ├── diff-engine/
│   ├── ai/
│   ├── shared/
│   └── config/
├── docker/
├── docs/
└── docker-compose.yml
```

## Quick start

```bash
# 1) Infrastructure
cp .env.example .env
docker compose up -d

# 2) Install
npm install

# 3) Database
npm run db:generate
npm run db:migrate -w @trace/database
# or: npm run migrate:dev -w @trace/database
npm run db:seed

# 4) Playwright browser
npx playwright install chromium

# 5) Run
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000/api/health  

Demo account (after seed): `demo@trace.dev` / `demo-password-change-me`

## Design system

UI colors, radii, and typography deliberately match the attached reference ([SLY](https://sly.clubop.site/)):

- Marketing: pure black cinematic surfaces, Space Grotesk display, white/opacity type
- App chrome: cream `#FFFAF6`, peach primary `hsl(17 80% 75%)` / `#F2A98C`, Inter body, `1rem` radius
- Orange gradient: `linear-gradient(135deg, #fbf3ec, #f7d9c8 34%, #f2a98c, #e4896b)`

## Documentation

- [Architecture](docs/architecture.md)
- [Crawler](docs/crawler.md)
- [Diff engine](docs/diff-engine.md)
- [AI investigations](docs/ai.md)
- [Security](docs/security.md)
- [Deployment](docs/deployment.md)

## Scripts

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run dev:worker
npm run db:migrate
npm run db:seed
npm run test
npm run lint
npm run typecheck
```

## Known limitations

- OAuth is scaffolded (`/api/auth/oauth/:provider`) but not enabled
- S3 storage adapter interface exists; local disk is the default
- Semantic (vector) search requires pgvector operationally; keyword search is fully implemented
- Unrestricted open-internet crawling is intentionally capped (depth/page limits + SSRF rules)

## License

MIT — portfolio / educational use.
