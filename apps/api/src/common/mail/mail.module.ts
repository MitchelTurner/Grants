import { Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { EMAIL, MailService, MemoryEmailProvider, PostmarkEmailProvider } from "./email.provider";

@Module({
  providers: [
    {
      provide: EMAIL,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.NODE_ENV === "test" || !env.POSTMARK_SERVER_TOKEN || !env.EMAIL_FROM) {
          return new MemoryEmailProvider();
        }
        return new PostmarkEmailProvider(env);
      },
    },
    MailService,
  ],
  exports: [EMAIL, MailService],
})
export class MailModule {}
