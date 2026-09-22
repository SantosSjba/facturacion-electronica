import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AuditModule } from "./infrastructure/audit/audit.module";
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
import { MetaModule } from "./interfaces/http/meta/meta.module";
import { HealthModule } from "./interfaces/http/health/health.module";
import { RequestIdMiddleware } from "./interfaces/http/middleware/request-id.middleware";
import { DocumentsModule } from "./interfaces/http/v1/documents.module";
import { WebhooksModule } from "./interfaces/http/v1/webhooks.module";
import { ValidationsModule } from "./interfaces/http/v1/validations.module";

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DbModule,
    RedisModule,
    ObjectStorageModule,
    QueuesModule,
    IdempotencyModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    DocumentsModule,
    WebhooksModule,
    ValidationsModule,
    MetaModule,
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
