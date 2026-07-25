# ── Production Dockerfile for Zity Chef ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build frontend bundle
COPY . .
RUN npm run build

# ── Production Runner Image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3002

CMD ["npx", "tsx", "server/index.ts"]
