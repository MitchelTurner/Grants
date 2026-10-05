import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// Turbo runs package scripts with this directory as cwd, so a root `.env`
// would be invisible to `import "dotenv/config"`. Load both. Real environment
// variables (CI, Railway) are not overridden.
const packageDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(packageDir, ".env") });
config({ path: resolve(packageDir, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
