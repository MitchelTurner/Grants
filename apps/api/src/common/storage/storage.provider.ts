import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import type { Env } from "../config/env";
import { safeEqual, signValue } from "../crypto";

export type StoredHead = { size: number; contentType: string };

export interface StorageProvider {
  mode: "memory" | "s3";
  presignPut(
    key: string,
    contentType: string,
    size: number,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(
    key: string,
    filename: string,
    attachment: boolean,
    expiresInSeconds?: number,
  ): Promise<string>;
  head(key: string): Promise<StoredHead | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

export const STORAGE = Symbol("STORAGE");

type MemoryObject = { body: Buffer; contentType: string };

export class MemoryStorageProvider implements StorageProvider {
  readonly mode = "memory" as const;
  private readonly objects = new Map<string, MemoryObject>();

  constructor(
    private readonly appUrl: string,
    private readonly secret: string,
  ) {}

  presignPut(
    key: string,
    contentType: string,
    _size: number,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const exp = Date.now() + 10 * 60 * 1000;
    const sig = signValue(this.secret, `PUT:${key}:${exp}`);
    const url = `${this.appUrl}/api/v1/dev-storage?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
    return Promise.resolve({ url, headers: { "content-type": contentType } });
  }

  presignGet(
    key: string,
    filename: string,
    attachment: boolean,
    expiresInSeconds = 300,
  ): Promise<string> {
    const exp = Date.now() + expiresInSeconds * 1000;
    const sig = signValue(this.secret, `GET:${key}:${exp}`);
    const url = `${this.appUrl}/api/v1/dev-storage?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}&filename=${encodeURIComponent(filename)}&attachment=${attachment ? "1" : "0"}`;
    return Promise.resolve(url);
  }

  head(key: string): Promise<StoredHead | null> {
    const found = this.objects.get(key);
    if (!found) return Promise.resolve(null);
    return Promise.resolve({ size: found.body.length, contentType: found.contentType });
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const found = this.objects.get(key);
    return Promise.resolve(found ? { body: found.body, contentType: found.contentType } : null);
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  authorize(method: "GET" | "PUT", key: string, exp: string, sig: string): boolean {
    const expires = Number(exp);
    if (!Number.isFinite(expires) || expires < Date.now()) {
      return false;
    }
    const expected = signValue(this.secret, `${method}:${key}:${exp}`);
    return safeEqual(expected, sig);
  }
}

export class S3StorageProvider implements StorageProvider {
  readonly mode = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    this.bucket = env.S3_BUCKET ?? "";
    this.client = new S3Client({
      region: env.S3_REGION ?? "auto",
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  async presignPut(
    key: string,
    contentType: string,
    size: number,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: 600 },
    );
    return { url, headers: { "content-type": contentType } };
  }

  async presignGet(
    key: string,
    filename: string,
    attachment: boolean,
    expiresInSeconds = 300,
  ): Promise<string> {
    const disposition = `${attachment ? "attachment" : "inline"}; filename="${filename.replaceAll('"', "")}"`;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async head(key: string): Promise<StoredHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export function storageKey(orgId: string, filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .slice(-40);
  const id = createHash("sha256")
    .update(`${orgId}:${filename}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
  return `orgs/${orgId}/${id}-${safe}`;
}

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE) readonly provider: StorageProvider) {}
}
