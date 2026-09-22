import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../../infrastructure/config/env.schema";
import { FakeCpeValidationAdapter } from "../../../infrastructure/validations/adapters/fake-cpe-validation";
import {
  CPE_VALIDATION_PORT,
  CpeValidationCache,
} from "../../../infrastructure/validations/cpe-validation.cache";
import { CpeValidationService } from "../../../infrastructure/validations/cpe-validation.service";
import { CompaniesModule } from "../companies/companies.module";
import { ValidationsController } from "./validations.controller";

@Module({
  imports: [CompaniesModule],
  controllers: [ValidationsController],
  providers: [
    CpeValidationCache,
    CpeValidationService,
    {
      provide: CPE_VALIDATION_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const mode = config.get("SUNAT_VALIDEZ_MODE", { infer: true });
        // Beta REST adapter deferred — Fake covers MVP/CI.
        if (mode === "beta") {
          return new FakeCpeValidationAdapter();
        }
        return new FakeCpeValidationAdapter();
      },
    },
  ],
  exports: [CpeValidationService],
})
export class ValidationsModule {}
