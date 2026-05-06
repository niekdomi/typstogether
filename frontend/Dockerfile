FROM oven/bun:1.3.13-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUn bun install --frozen-lockfile

COPY tsconfig.json ./
COPY backend/ ./backend/
COPY frontend/ ./frontend/

ARG VITE_API_URL
ARG VITE_COLLAB_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_COLLAB_URL=$VITE_COLLAB_URL

RUN bun run --filter @typstogether/frontend build

FROM caddy:2.11.2-alpine
COPY --from=builder /app/frontend/dist /srv
