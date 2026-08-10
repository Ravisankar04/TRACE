# Deployment

## Local

```bash
docker compose up -d
cp .env.example .env
npm install
npx playwright install chromium
npm run db:generate
cd packages/database && npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Production sketch

1. Managed Postgres + Redis
2. Build images for `api`, `worker`, `web`
3. Set strong `SESSION_SECRET`, `COOKIE_SECURE=true`
4. Point `STORAGE_DRIVER=s3` when ready (interface exists; implement SDK wiring)
5. Put web behind TLS; API private or same-origin reverse proxy

## CI

GitHub Actions runs install, unit tests, typebuild of packages, and lint on PR.

## Docker services

`docker-compose.yml` provides Postgres (pgvector image) + Redis for development.
