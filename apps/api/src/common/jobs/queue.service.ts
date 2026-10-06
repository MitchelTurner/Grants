import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { ENV, type Env } from "../config/env";
import { redisConnectionOptions } from "../../worker/redis-connection";

export type QueuedJob = {
  name: string;
  data: unknown;
  jobId?: string;
  delay?: number;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  readonly memory: QueuedJob[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {}

  async enqueue(
    name: string,
    data: unknown,
    options?: { jobId?: string; delay?: number },
  ): Promise<void> {
    if (this.env.NODE_ENV === "test") {
      this.memory.push({ name, data, jobId: options?.jobId, delay: options?.delay });
      return;
    }
    const queue = this.queue(name);
    if (options?.jobId) {
      const existing = await queue.getJob(options.jobId);
      if (existing) {
        await existing.remove();
      }
    }
    await queue.add(name, data, {
      jobId: options?.jobId,
      delay: options?.delay,
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  private queue(name: string): Queue {
    const found = this.queues.get(name);
    if (found) return found;
    const created = new Queue(name, { connection: redisConnectionOptions(this.env.REDIS_URL) });
    this.queues.set(name, created);
    return created;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
