#!/bin/sh
set -eu
cd /app/packages/db
pnpm exec prisma migrate deploy
cd /app
exec node apps/api/dist/main.js
