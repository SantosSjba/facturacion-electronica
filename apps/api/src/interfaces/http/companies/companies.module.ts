import { Module } from "@nestjs/common";

import { CompaniesService } from "../../../infrastructure/companies/companies.service";
import { CredentialsVault } from "../../../infrastructure/crypto/credentials-vault";
import { CredentialsService } from "../../../infrastructure/credentials/credentials.service";
import { SeriesService } from "../../../infrastructure/series/series.service";
import { CompaniesController } from "./companies.controller";
import { CredentialsController } from "./credentials.controller";
import { SeriesController } from "./series.controller";

@Module({
  controllers: [CompaniesController, CredentialsController, SeriesController],
  providers: [
    CompaniesService,
    CredentialsService,
    SeriesService,
    CredentialsVault,
  ],
  exports: [CompaniesService, CredentialsService, SeriesService],
})
export class CompaniesModule {}
