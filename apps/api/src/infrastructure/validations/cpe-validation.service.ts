import { Inject, Injectable } from "@nestjs/common";
import { AppError } from "@factosys/shared";

import { CompaniesService } from "../companies/companies.service";
import {
  CPE_VALIDATION_PORT,
  CpeValidationCache,
} from "./cpe-validation.cache";
import type {
  CpeValidationPort,
  CpeValidationRequest,
} from "./cpe-validation.port";

const ALLOWED_TYPES = new Set(["01", "03", "07", "08"]);

@Injectable()
export class CpeValidationService {
  constructor(
    private readonly companies: CompaniesService,
    private readonly cache: CpeValidationCache,
    @Inject(CPE_VALIDATION_PORT) private readonly port: CpeValidationPort,
  ) {}

  async validate(
    organizationId: string,
    body: {
      company_id: string;
      ruc: string;
      document_type: string;
      serie: string;
      number: string | number;
      issue_date: string;
      total_amount: number;
    },
  ) {
    await this.companies.requireCompany(organizationId, body.company_id);

    if (!/^\d{11}$/.test(body.ruc)) {
      throw AppError.validation("ruc must be 11 digits", [
        { path: "ruc", issue: "format" },
      ]);
    }
    if (!ALLOWED_TYPES.has(body.document_type)) {
      throw AppError.validation("document_type not allowed", [
        { path: "document_type", issue: body.document_type },
      ]);
    }
    if (!body.serie?.trim() || body.number === "" || body.number == null) {
      throw AppError.validation("serie and number are required");
    }
    if (
      typeof body.total_amount !== "number" ||
      body.total_amount < 0 ||
      !Number.isFinite(body.total_amount)
    ) {
      throw AppError.validation("total_amount invalid", [
        { path: "total_amount", issue: "invalid" },
      ]);
    }

    const input: CpeValidationRequest = {
      companyId: body.company_id,
      ruc: body.ruc,
      documentType: body.document_type,
      serie: body.serie.trim().toUpperCase(),
      number: String(body.number),
      issueDate: body.issue_date,
      totalAmount: Math.round(body.total_amount * 100) / 100,
    };

    const cached = await this.cache.get(organizationId, input);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await this.port.validate(input);
    await this.cache.set(organizationId, input, result);
    return { ...result, cached: false };
  }
}
