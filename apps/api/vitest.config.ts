import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/segrants",
      REDIS_URL: "redis://localhost:6379",
      SESSION_SECRET: "test-session-secret-should-be-32b",
      CSRF_SECRET: "test-csrf-secret-should-be-32chars",
    },
  },
});
