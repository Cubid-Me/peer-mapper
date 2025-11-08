# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY indexer/package.json indexer/package.json
RUN pnpm install --filter indexer... --prod --no-optional

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter indexer build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/indexer/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/api.js"]
