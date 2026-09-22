import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { DbModule } from "../../../infrastructure/persistence/db.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule, DbModule],
  controllers: [HealthController],
})
export class HealthModule {}
