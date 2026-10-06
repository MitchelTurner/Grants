import { Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import {
  MemoryStorageProvider,
  S3StorageProvider,
  STORAGE,
  StorageService,
} from "./storage.provider";

@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env) => {
        const ready =
          env.NODE_ENV !== "test" &&
          env.S3_ENDPOINT &&
          env.S3_BUCKET &&
          env.S3_ACCESS_KEY_ID &&
          env.S3_SECRET_ACCESS_KEY;
        if (!ready) {
          return new MemoryStorageProvider(env.APP_URL, env.CSRF_SECRET);
        }
        return new S3StorageProvider(env);
      },
    },
    StorageService,
  ],
  exports: [STORAGE, StorageService],
})
export class StorageModule {}
