import { Global, Module, type OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";

import type { Env } from "../config/env.schema";
import { ObjectStorageService } from "./object-storage.service";
import { S3_CLIENT } from "./storage.tokens";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const endpoint = config.get("MINIO_ENDPOINT", { infer: true });
        return new S3Client({
          endpoint,
          region: config.get("MINIO_REGION", { infer: true }),
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.get("MINIO_ACCESS_KEY", { infer: true }),
            secretAccessKey: config.get("MINIO_SECRET_KEY", { infer: true }),
          },
        });
      },
    },
    ObjectStorageService,
  ],
  exports: [S3_CLIENT, ObjectStorageService],
})
export class ObjectStorageModule implements OnModuleInit {
  constructor(private readonly storage: ObjectStorageService) {}

  async onModuleInit(): Promise<void> {
    await this.storage.ensureBucket();
  }
}
