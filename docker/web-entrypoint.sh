#!/bin/sh
set -u

# SPEC-QUESTION: A linked Railway Postgres service may set DATABASE_PRIVATE_URL
# or DATABASE_PUBLIC_URL and leave DATABASE_URL empty. Copy the real connection
# string. Do not invent a host. Do not exit here: the server has to listen
# before Railway's deploy probe, even when migrations cannot run.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DATABASE_PRIVATE_URL:-}" ]; then
  export DATABASE_URL="$DATABASE_PRIVATE_URL"
fi
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. The server will start and report the database as down." >&2
fi

cd /app
exec node apps/api/dist/main.js
