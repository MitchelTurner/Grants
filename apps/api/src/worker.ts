import "reflect-metadata";
import "./instrument";
import { NestFactory } from "@nestjs/core";
import { Queue, Worker } from "bullmq";
import pino from "pino";
import { AppModule } from "./app.module";
import { loadEnv } from "./common/config/env";
import { MailService } from "./common/mail/email.provider";
import { SmsService } from "./common/sms/sms.provider";
import { redisConnectionOptions } from "./worker/redis-connection";
import { DigestService } from "./modules/digest/digest.service";
import { DirectoryService } from "./modules/directory/directory.service";
import { ExportService } from "./modules/export/export.service";
import { WriteService } from "./modules/ai/write.service";
import { RemindersService } from "./modules/reminders/reminders.service";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({ level: env.LOG_LEVEL });
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const connection = redisConnectionOptions(env.REDIS_URL);
  const reminders = app.get(RemindersService);
  const digest = app.get(DigestService);
  const directory = app.get(DirectoryService);
  const exports = app.get(ExportService);
  const mail = app.get(MailService);
  const writing = app.get(WriteService);
  const sms = app.get(SmsService);

  const workers = [
    new Worker("reminders:send", async (job) => reminders.send(String(job.data.reminderId)), {
      connection,
    }),
    new Worker("reminders:sweep", async () => reminders.sweep(), { connection }),
    new Worker("digest:user-weekly", async () => digest.sendUserWeeklies(), { connection }),
    new Worker("digest:public-draft", async () => digest.draftPublicIssue(), { connection }),
    new Worker("digest:public-send", async (job) => digest.sendPublic(String(job.data.issueId)), {
      connection,
    }),
    new Worker("opportunities:lifecycle", async () => directory.runLifecycle(), { connection }),
    new Worker(
      "orgs:export",
      async (job) => exports.build(String(job.data.orgId), String(job.data.userId)),
      { connection },
    ),
    new Worker("cleanup:hard-delete", async () => exports.hardDelete(), { connection }),
    new Worker(
      "email:send",
      async (job) => {
        await mail.send(job.data);
      },
      { connection },
    ),
    new Worker("ai:rfp-parse", async (job) => writing.processRfpParse(String(job.data.parseId)), {
      connection,
    }),
    new Worker(
      "ai:report-draft",
      async (job) => {
        const data = job.data as {
          jobId: string;
          organizationId: string;
          userId: string;
          sectionId: string;
          heading: string;
          body: string;
          criteria: Array<{ criterion: string; points: number | null }>;
        };
        await writing.processReportDraft(data);
      },
      { connection },
    ),
    new Worker(
      "sms:send",
      async (job) => {
        await sms.send(job.data);
      },
      { connection },
    ),
  ];

  const schedules = new Queue("schedules", { connection });
  await schedules.add(
    "reminders:sweep",
    {},
    { repeat: { every: 15 * 60 * 1000 }, jobId: "reminders-sweep" },
  );
  await schedules.add(
    "digest:user-weekly",
    {},
    { repeat: { pattern: "0 * * * *" }, jobId: "user-weekly" },
  );
  await schedules.add(
    "digest:public-draft",
    {},
    { repeat: { pattern: "0 18 * * 0", tz: "America/Juneau" }, jobId: "public-draft" },
  );
  await schedules.add(
    "opportunities:lifecycle",
    {},
    { repeat: { pattern: "0 2 * * *", tz: "America/Juneau" }, jobId: "lifecycle" },
  );
  await schedules.add(
    "cleanup:hard-delete",
    {},
    { repeat: { pattern: "0 3 * * *", tz: "America/Juneau" }, jobId: "hard-delete" },
  );

  const scheduleWorker = new Worker(
    "schedules",
    async (job) => {
      if (job.name === "reminders:sweep") await reminders.sweep();
      if (job.name === "digest:user-weekly") await digest.sendUserWeeklies();
      if (job.name === "digest:public-draft") await digest.draftPublicIssue();
      if (job.name === "opportunities:lifecycle") await directory.runLifecycle();
      if (job.name === "cleanup:hard-delete") await exports.hardDelete();
    },
    { connection },
  );
  workers.push(scheduleWorker);

  logger.info("Worker ready");
  const shutdown = async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await schedules.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
}

void main();
