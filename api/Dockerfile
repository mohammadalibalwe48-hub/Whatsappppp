# --- Stage 1: build --------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json

RUN npm install --no-audit --no-fund

COPY api ./api

RUN npm run build:api

# --- Stage 2: runtime ------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json

RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/api/dist ./api/dist

EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "api/dist/index.js"]
