FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# prisma.config.ts requires DATABASE_URL even for generate. The build does not connect.
RUN DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/segrants \
  pnpm --filter @se-grants/db generate \
  && pnpm --filter @se-grants/shared build \
  && DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/segrants \
  pnpm --filter @se-grants/db build \
  && pnpm --filter @se-grants/web build \
  && pnpm --filter @se-grants/api build \
  && chmod +x docker/web-entrypoint.sh \
  && chown -R node:node /app

USER node
ENV NODE_ENV=production
EXPOSE 3000

CMD ["docker/web-entrypoint.sh"]
