# syntax=docker/dockerfile:1
# Build context: ./api
# (Railway sets "Root Directory" = api ⇒ build context becomes api/.)

# --- Stage 1: build --------------------------------------------------------
FROM node:22-bookworm-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Keep npm current on Node 22; the image's bundled npm has been exiting
# unexpectedly during clean production installs in Fly's build environment.
RUN npm install --global npm@11.9.0 --no-audit --no-fund

COPY package.json package-lock.json ./

RUN --mount=type=secret,id=proxy_ca,target=/run/secrets/proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" && \
    npm ci --legacy-peer-deps --no-audit --no-fund

COPY tsconfig.json ./
COPY .eslintrc.cjs ./
COPY src ./src

RUN npm run build \
    && npm prune --omit=dev --no-audit --no-fund

# --- Stage 2: runtime ------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
