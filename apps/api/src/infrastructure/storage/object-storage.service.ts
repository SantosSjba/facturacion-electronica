import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env.schema";
import { buildDocumentObjectKey } from "./object-storage.keys";
import { S3_CLIENT } from "./storage.tokens";

export { buildDocumentObjectKey };

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly bucket: string;
  private readonly defaultPresignTtlSec: number;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get("MINIO_BUCKET", { infer: true });
    this.defaultPresignTtlSec = config.get("MINIO_PRESIGN_TTL_SEC", {
      infer: true,
    });
  }

  getBucket(): string {
    return this.bucket;
  }

  buildDocumentObjectKey = buildDocumentObjectKey;

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

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Short-lived signed GET URL for API downloads (doc 26 §5).
   */
  async getPresignedGetUrl(
    key: string,
    expiresInSec?: number,
  ): Promise<string> {
    const expiresIn = expiresInSec ?? this.defaultPresignTtlSec;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}
