FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY packages ./packages
RUN npm install

FROM deps AS build
COPY . .
RUN npm run build:packages

FROM base AS api
COPY --from=build /app /app
WORKDIR /app
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@trace/api"]

FROM base AS worker
COPY --from=build /app /app
RUN npx playwright install --with-deps chromium
WORKDIR /app
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@trace/worker"]

FROM base AS web
COPY --from=build /app /app
WORKDIR /app
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@trace/web"]
