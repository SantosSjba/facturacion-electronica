import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AppConfigModule } from "./infrastructure/config/config.module";
import { IdempotencyModule } from "./infrastructure/idempotency/idempotency.module";
import { LoggingModule } from "./infrastructure/logging/logging.module";
import { DbModule } from "./infrastructure/persistence/db.module";
import { QueuesModule } from "./infrastructure/queues/queue.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { ObjectStorageModule } from "./infrastructure/storage/object-storage.module";
import { AuthModule } from "./interfaces/http/auth/auth.module";
import { CompaniesModule } from "./interfaces/http/companies/companies.module";
import { AppExceptionFilter } from "./interfaces/http/filters/app-exception.filter";
import { HealthModule } from "./interfaces/http/health/health.module";
import { RequestIdMiddleware } from "./interfaces/http/middleware/request-id.middleware";
import { DocumentsModule } from "./interfaces/http/v1/documents.module";

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DbModule,
    RedisModule,
    ObjectStorageModule,
    QueuesModule,
    IdempotencyModule,
    AuthModule,
    CompaniesModule,
    DocumentsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
