import { Injectable } from "@nestjs/common";
import { AppError } from "@factosys/shared";
import {
  XmlDespatchAdviceBuilder,
  despatchCanonicalSchema,
  XmlSummaryDocumentsBuilder,
  XmlVoidedDocumentsBuilder,
  XmlTaxAgentBuilder,
  toTaxAgentCanonical,
} from "@factosys/sunat-ubl";
import { CompaniesService } from "../companies/companies.service";
import { SummaryPoolService } from "../documents/summary-pool.service";
import { TaxAgentService } from "../documents/tax-agent.service";
import { supplierParty } from "../documents/cpe-input";
import type { AuxiliaryPreviewCreate } from "../../interfaces/http/dto/preview-create.schema";

@Injectable()
export class AuxiliaryPreviewService {
  constructor(
    private readonly companies: CompaniesService,
    private readonly pool: SummaryPoolService,
    private readonly agents: TaxAgentService,
  ) {}
  async build(
    org: string,
    body: AuxiliaryPreviewCreate,
  ): Promise<{ canonical: Record<string, unknown>; xml: string }> {
    const company = await this.companies.requireActiveCompany(org, body.document.company_id);
    const supplier = supplierParty(company);
    if (body.document_type === "09" || body.document_type === "31") {
      if (body.document.document_type !== body.document_type)
        throw AppError.validation("Preview document type mismatch", [], { httpStatus: 422 });
      const { company_id, supplier: supplierPartyInput, ...document } = body.document;
      void company_id;
      const parsed = despatchCanonicalSchema.safeParse({
        ...document,
        supplier,
        supplier_party: supplierPartyInput,
        number: 1,
      });
      if (!parsed.success)
        throw AppError.validation(
          "Invalid GRE preview",
          parsed.error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })),
          { httpStatus: 422 },
        );
      const canonical = parsed.data;
      return {
        canonical: canonical as unknown as Record<string, unknown>,
        xml: new XmlDespatchAdviceBuilder().build(canonical).xml,
      };
    }
    if (body.document_type === "20" || body.document_type === "40") {
      const { company_id, ...document } = body.document;
      void company_id;
      if (
        body.document_type === "20"
          ? !company.taxAgentSettings.retention
          : !company.taxAgentSettings.perception_regimes.includes(
              document.regime as "01" | "02" | "03",
            )
      )
        throw AppError.validation("Company not enabled for this tax-agent regime", [], {
          httpStatus: 422,
        });
      const canonical = toTaxAgentCanonical(
        body.document_type,
        document,
        { ...supplier, identity_type: "6" },
        1,
      );
      return {
        canonical: canonical as unknown as Record<string, unknown>,
        xml: new XmlTaxAgentBuilder().build(canonical).xml,
      };
    }
    if (body.document_type === "RR") {
      const c = await this.agents.previewReversion(org, body.document);
      return {
        canonical: { ...c, document_type: "RR" },
        xml: new XmlVoidedDocumentsBuilder().build(c).xml,
      };
    }
    const document = body.document;
    const date =
      document.issue_date ??
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    if (document.reference_date > date)
      throw AppError.validation("Reference date exceeds issue date", [], { httpStatus: 422 });
    const id = `${body.document_type}-${document.reference_date.replace(/-/g, "")}-1`;
    if (body.document_type === "RA") {
      const c = {
        id,
        reference_date: document.reference_date,
        issue_date: date,
        supplier,
        lines: body.document.documents.map((d, i) => {
          if (d.serie_number && !/^F[A-Z0-9]{3}-\d{1,8}$/i.test(d.serie_number))
            throw AppError.validation("RA requires F-series invoice or note identifiers", [], {
              httpStatus: 422,
            });
          const serie = (d.serie_number ? d.serie_number.split("-")[0] : d.serie)?.toUpperCase();
          const number = d.serie_number ? d.serie_number.split("-")[1] : d.number;
          if (
            !serie ||
            !/^[F][A-Z0-9]{3}$/i.test(serie) ||
            !Number.isSafeInteger(Number(number)) ||
            Number(number) < 1 ||
            Number(number) > 99999999 ||
            !["01", "07", "08"].includes(d.document_type)
          )
            throw AppError.validation("RA requires F-series invoice or note identifiers", [], {
              httpStatus: 422,
            });
          return {
            line_id: i + 1,
            document_type: d.document_type,
            serie,
            number: Number(number),
            reason: d.reason,
          };
        }),
      };
      if (
        new Set(c.lines.map((l) => `${l.document_type}-${l.serie}-${l.number}`)).size !==
        c.lines.length
      )
        throw AppError.validation("Duplicate RA document", [], { httpStatus: 422 });
      return {
        canonical: { ...c, document_type: "RA" },
        xml: new XmlVoidedDocumentsBuilder().build(c).xml,
      };
    }
    if (body.document_type === "RC") {
      const rows = await this.pool.resolvePool({
        organizationId: org,
        companyId: company.id,
        referenceDate: body.document.reference_date,
        documentIds: body.document.document_ids,
        lineOverrides: body.document.lines,
      });
      if (rows.length > 500)
        throw AppError.validation("Preview supports up to 500 lines", [], { httpStatus: 422 });
      const c = {
        id,
        reference_date: body.document.reference_date,
        issue_date: date,
        supplier,
        lines: rows.map((l, i) => ({
          line_id: i + 1,
          document_type: l.documentType,
          serie_number: l.serieNumber,
          status: l.status,
          customer: l.customer,
          totals: l.totals,
          affected_document: l.affectedDocument,
          perception: l.perception,
        })),
      };
      return {
        canonical: { ...c, document_type: "RC" },
        xml: new XmlSummaryDocumentsBuilder().build(c).xml,
      };
    }
    throw AppError.validation("Unsupported preview", [], { httpStatus: 422 });
  }
}
