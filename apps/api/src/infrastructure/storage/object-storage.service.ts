import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env.schema";
import { S3_CLIENT } from "./storage.tokens";

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get("MINIO_BUCKET", { infer: true });
  }

  getBucket(): string {
    return this.bucket;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      this.logger.log(`Creating bucket ${this.bucket}`);
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Empty object: ${key}`);
    }
    return Buffer.from(bytes);
  }
}
