import "reflect-metadata";
import "./instrument";
import { Queue } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { loadEnv } from "./common/config/env";
import { redisConnectionOptions } from "./worker/redis-connection";

/**
 * Worker entry. Product queues from SPEC §10 are registered in later milestones.
 * This process proves Redis and BullMQ can connect, then stays up for Railway.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({ level: env.LOG_LEVEL });
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue("scaffold", { connection: redisConnectionOptions(env.REDIS_URL) });

  const shutdown = async (code: number) => {
    await queue.close().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    process.exit(code);
  };

  process.on("SIGTERM", () => {
    void shutdown(0);
  });
  process.on("SIGINT", () => {
    void shutdown(0);
  });

  try {
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }
    await queue.waitUntilReady();
    logger.info("Worker ready");
  } catch (error) {
    logger.error(
      { name: error instanceof Error ? error.name : "unknown" },
      "Worker failed to start",
    );
    await shutdown(1);
  }
}

void main();
