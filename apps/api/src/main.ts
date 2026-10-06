import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./bootstrap";
import { loadEnv } from "./common/config/env";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await createApp();
  await app.listen(env.PORT, "0.0.0.0");
  if (env.NODE_ENV === "production") {
    applyMigrations();
  }
}

function applyMigrations(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Skipping migrations because DATABASE_URL is not set.");
    return;
  }
  const prisma = [
    join(process.cwd(), "packages/db/node_modules/.bin/prisma"),
    join(process.cwd(), "../../packages/db/node_modules/.bin/prisma"),
    "/app/packages/db/node_modules/.bin/prisma",
  ].find((path) => existsSync(path));
  if (!prisma) {
    console.error("Skipping migrations because the Prisma CLI is not in the image.");
    return;
  }
  const cwd = prisma.startsWith("/app/") ? "/app/packages/db" : join(prisma, "../../..");
  const child = spawn(prisma, ["migrate", "deploy"], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(`Migrations could not start. The server is still listening. ${error.message}`);
  });
  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Migrations exited with code ${code}. The server is still listening.`);
    }
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
