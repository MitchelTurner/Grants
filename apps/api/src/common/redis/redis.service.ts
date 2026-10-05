import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { ENV, type Env } from "../config/env";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.client.on("error", () => {
      // Connection errors are surfaced by ping(). Swallow the emitter so a
      // downed Redis does not crash the process before /health can answer.
    });
  }

  async ping(): Promise<"ok" | "error"> {
    try {
      if (this.client.status === "wait" || this.client.status === "end") {
        await this.client.connect();
      }
      const result = await this.client.ping();
      return result === "PONG" ? "ok" : "error";
    } catch {
      this.logger.error("Redis health check failed");
      return "error";
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
