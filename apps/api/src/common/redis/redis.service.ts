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

  private async ready(): Promise<Redis> {
    if (this.client.status === "wait" || this.client.status === "end") {
      await this.client.connect();
    }
    return this.client;
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    const client = await this.ready();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }
    return count;
  }

  async put(key: string, value: string, seconds: number): Promise<void> {
    const client = await this.ready();
    await client.set(key, value, "EX", seconds);
  }

  async read(key: string): Promise<string | null> {
    const client = await this.ready();
    return client.get(key);
  }

  async remove(key: string): Promise<void> {
    const client = await this.ready();
    await client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
