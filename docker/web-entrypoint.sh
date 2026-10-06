#!/bin/sh
set -eu

# SPEC-QUESTION: A linked Railway Postgres service may set DATABASE_PRIVATE_URL
# or DATABASE_PUBLIC_URL and leave DATABASE_URL empty. Copy the real connection
# string. Do not invent a host.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DATABASE_PRIVATE_URL:-}" ]; then
  export DATABASE_URL="$DATABASE_PRIVATE_URL"
fi
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Add the Postgres connection string to this service before it starts." >&2
  exit 1
fi

cd /app/packages/db
./node_modules/.bin/prisma migrate deploy
cd /app
exec node apps/api/dist/main.js
