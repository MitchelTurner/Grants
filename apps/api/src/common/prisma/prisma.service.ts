import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@se-grants/db";
import { ENV, type Env } from "../config/env";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly db: PrismaClient;

  constructor(@Inject(ENV) env: Env) {
    this.db = createPrismaClient(env.DATABASE_URL);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.db.$connect();
    } catch {
      // The health check reports the failure. Booting lets Railway see a 503
      // instead of a crash loop with no HTTP response.
      this.logger.error("Database connection failed during startup");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}
