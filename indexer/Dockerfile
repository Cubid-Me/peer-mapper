# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY addresses.json ./

# Copy indexer package
COPY indexer/package.json ./indexer/

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile --filter indexer

# Build stage
FROM deps AS build

# Copy indexer source
COPY indexer ./indexer

# Build indexer
RUN pnpm --filter indexer build

# Runtime stage  
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app

# Copy workspace files
COPY --from=base /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=base /app/addresses.json ./
COPY --from=base /app/indexer/package.json ./indexer/

# Copy node_modules from deps stage (includes all dependencies with native modules compiled)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/indexer/node_modules ./indexer/node_modules

# Copy built app
COPY --from=build /app/indexer/dist ./indexer/dist

WORKDIR /app/indexer

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

USER node

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/api.js"]
