import { Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { MemorySmsProvider, SMS, SmsService, TwilioSmsProvider } from "./sms.provider";

@Module({
  providers: [
    {
      provide: SMS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const ready =
          env.NODE_ENV !== "test" &&
          env.TWILIO_ACCOUNT_SID &&
          env.TWILIO_AUTH_TOKEN &&
          (env.TWILIO_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID);
        return ready ? new TwilioSmsProvider(env) : new MemorySmsProvider();
      },
    },
    SmsService,
  ],
  exports: [SMS, SmsService],
})
export class SmsModule {}
