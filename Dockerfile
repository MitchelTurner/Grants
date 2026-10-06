FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The node user must see the prepared pnpm. Otherwise every boot asks Corepack
# to download it again.
ENV COREPACK_HOME=/opt/corepack
RUN mkdir -p /opt/corepack \
  && corepack enable \
  && corepack prepare pnpm@10.33.3 --activate \
  && chmod -R a+rX /opt/corepack

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# prisma generate does not open a connection. A missing DATABASE_URL is filled
# only for that command. Do not bake a production database URL into the image.
RUN pnpm --filter @se-grants/db generate \
  && pnpm --filter @se-grants/shared build \
  && pnpm --filter @se-grants/db build \
  && pnpm --filter @se-grants/web build \
  && pnpm --filter @se-grants/api build \
  && chmod +x docker/web-entrypoint.sh \
  && chown -R node:node /app /opt/corepack

USER node
ENV NODE_ENV=production
EXPOSE 3000

CMD ["docker/web-entrypoint.sh"]
