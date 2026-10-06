import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// Turbo runs package scripts with this directory as cwd, so a root `.env`
// would be invisible to `import "dotenv/config"`. Load both. Real environment
// variables (CI, Railway) are not overridden.
const packageDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(packageDir, ".env"), quiet: true });
config({ path: resolve(packageDir, "../../.env"), quiet: true });

// SPEC-QUESTION: Prisma 7 evaluates env("DATABASE_URL") while loading this
// file, including for `prisma generate`, which does not open a connection.
// Turbo's strict mode drops undeclared variables, and a linked Railway
// Postgres service may expose DATABASE_PRIVATE_URL instead of DATABASE_URL.
// Generate may use a local placeholder. Migrate and seed still require a real URL.
const generatePlaceholder = "postgresql://postgres:postgres@127.0.0.1:5432/segrants";

function databaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    const linked = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_PUBLIC_URL;
    if (linked) {
      process.env.DATABASE_URL = linked;
    }
  }
  if (!process.env.DATABASE_URL && process.argv.slice(2)[0] === "generate") {
    process.env.DATABASE_URL = generatePlaceholder;
  }
  return env("DATABASE_URL");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
  },
});
