import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@se-grants/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.pingDatabase(), this.redis.ping()]);
    return {
      status: database === "ok" && redis === "ok" ? "ok" : "degraded",
      service: "se-grants-api",
      checks: { database, redis },
    };
  }

  private async pingDatabase(): Promise<"ok" | "error"> {
    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
      return "ok";
    } catch {
      return "error";
    }
  }
}
