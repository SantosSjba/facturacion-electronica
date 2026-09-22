import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AppConfigModule } from "./infrastructure/config/config.module";
import { LoggingModule } from "./infrastructure/logging/logging.module";
import { DbModule } from "./infrastructure/persistence/db.module";
import { AppExceptionFilter } from "./interfaces/http/filters/app-exception.filter";
import { HealthModule } from "./interfaces/http/health/health.module";
import { RequestIdMiddleware } from "./interfaces/http/middleware/request-id.middleware";

@Module({
  imports: [AppConfigModule, LoggingModule, DbModule, HealthModule],
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
