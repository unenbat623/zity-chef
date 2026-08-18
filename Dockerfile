# ── Production Dockerfile for Zity Chef ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build frontend bundle
# (.dockerignore keeps .env, node_modules and dist out of the build context —
#  without it the real secrets were baked into this layer.)
COPY . .
RUN npm run build

# ── Production Runner Image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# `tsx` runs the server, so it must be a runtime dependency — with it in
# devDependencies this install skipped it and `npx tsx` tried to fetch it from
# the registry on every container start.
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
# The inventory route type-imports from the client tree; esbuild elides it
# today, but copying the types keeps the container from breaking the moment a
# value export is added there.
COPY --from=builder /app/client/src/types.ts ./client/src/types.ts

# Drop root privileges — the node image ships an unprivileged `node` user.
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "server/index.ts"]
