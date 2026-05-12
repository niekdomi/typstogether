ARG BUN_VERSION=1.3.13

FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN bun install --frozen-lockfile --filter @typstogether/backend

COPY tsconfig.json ./
COPY backend/ ./backend/

RUN cd backend && bun build src/index.ts src/migrate.ts --target=bun --bytecode --minify --sourcemap --outdir=dist

FROM oven/bun:${BUN_VERSION}-alpine
WORKDIR /app

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/drizzle ./drizzle
ENV NODE_ENV=production
CMD ["sh", "-c", "bun run dist/migrate.js && bun run dist/index.js"]
