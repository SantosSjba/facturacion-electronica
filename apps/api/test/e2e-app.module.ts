import { Module } from "@nestjs/common";

import { AppModule } from "../src/app.module";
import { ErrorProbeController } from "./error-probe.controller";

@Module({
  imports: [AppModule],
  controllers: [ErrorProbeController],
})
export class E2eAppModule {}
