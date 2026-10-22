# syntax=docker/dockerfile:1

# Multi-stage build: compile with every dependency, ship only what production needs.
# Result: no TypeScript sources, no tests and no dev tools in the final image.

# ---- base: shared starting point --------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app

# ---- build: all dependencies + TypeScript compiler -> dist/ -----------------------------------
FROM base AS build
# Copy the manifests first: as long as they don't change, Docker reuses the cached `npm ci` layer.
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- prod-deps: runtime dependencies only (no TypeScript, Vitest, ESLint...) ------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime: the image that actually runs ----------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
# --chown: the app reads package.json at startup (version), and it must stay readable for the
# non-root user even if the file on your machine is only readable by you.
COPY --chown=node:node package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Never run as root: if the app is compromised, the attacker doesn't own the container.
USER node
EXPOSE 3000

# Docker (and docker compose) mark the container unhealthy if /health stops answering.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Exec form: node is PID 1 and receives SIGTERM directly, so the graceful shutdown in server.ts runs.
CMD ["node", "dist/server.js"]
