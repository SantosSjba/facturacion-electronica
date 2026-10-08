import { Module } from "@nestjs/common";

import { CompaniesService } from "../../../infrastructure/companies/companies.service";
import { CompanyLogoService } from "../../../infrastructure/companies/company-logo.service";
import { CompanyLogoController } from "./company-logo.controller";
import { CredentialsVault } from "../../../infrastructure/crypto/credentials-vault";
import { CredentialsService } from "../../../infrastructure/credentials/credentials.service";
import { SeriesService } from "../../../infrastructure/series/series.service";
import { CompaniesController } from "./companies.controller";
import { CredentialsController } from "./credentials.controller";
import { SeriesController } from "./series.controller";

@Module({
  controllers: [CompaniesController, CompanyLogoController, CredentialsController, SeriesController],
  providers: [
    CompaniesService,
    CompanyLogoService,
    CredentialsService,
    SeriesService,
    CredentialsVault,
  ],
  exports: [CompaniesService, CompanyLogoService, CredentialsService, SeriesService, CredentialsVault],
})
export class CompaniesModule {}
