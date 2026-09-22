import { Module } from "@nestjs/common";

import { AppModule } from "../src/app.module";
import { IdempotencyModule } from "../src/infrastructure/idempotency/idempotency.module";
import { ErrorProbeController } from "./error-probe.controller";
import { IdempotencyProbeController } from "./idempotency-probe.controller";

@Module({
  imports: [AppModule, IdempotencyModule],
  controllers: [ErrorProbeController, IdempotencyProbeController],
})
export class E2eAppModule {}
