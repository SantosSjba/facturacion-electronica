import { Inject, Injectable, HttpException } from "@nestjs/common";
import { AppError } from "@factosys/shared";
import type { Db } from "@factosys/db";
import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
} from "@factosys/sunat-ubl";
import { CompaniesService } from "../companies/companies.service";
import { validateCpeInput, supplierParty } from "../documents/cpe-input";
import { validatePrepayments } from "../documents/prepayment-validation";
import { EmitCreditNoteUseCase, EmitDebitNoteUseCase } from "../documents/emit-note.use-case";
import { DB } from "../persistence/db.tokens";
import type {
  PreviewCreate,
  AuxiliaryPreviewCreate,
} from "../../interfaces/http/dto/preview-create.schema";
import { PdfService } from "./pdf.service";
import { AuxiliaryPreviewService } from "./auxiliary-preview.service";

/** Read-only: no series allocator, signer, storage writes, queue or acceptance events. */
@Injectable()
export class PreviewService {
  private readonly active = new Map<string, number>();
  private activeTotal = 0;
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly credit: EmitCreditNoteUseCase,
    private readonly debit: EmitDebitNoteUseCase,
    private readonly pdf: PdfService,
    private readonly auxiliary?: AuxiliaryPreviewService,
  ) {}

  async build(organizationId: string, body: PreviewCreate) {
    const rows =
      ("lines" in body.document ? body.document.lines : undefined) ??
      ("documents" in body.document ? body.document.documents : undefined) ??
      ("document_ids" in body.document ? body.document.document_ids : undefined) ??
      [];
    if (
      (Array.isArray(rows) ? rows.length : 0) > 500 ||
      Buffer.byteLength(JSON.stringify(body)) > 200_000
    )
      throw AppError.validation("Preview supports up to 500 lines / 200 KB", [], {
        httpStatus: 422,
      });
    if (
      body.document_type !== "01" &&
      body.document_type !== "03" &&
      body.document_type !== "07" &&
      body.document_type !== "08"
    ) {
      if (!this.auxiliary) throw AppError.internal("Auxiliary preview service unavailable");
      return this.auxiliary.build(organizationId, body as AuxiliaryPreviewCreate);
    }
    const company = await this.companies.requireActiveCompany(
      organizationId,
      body.document.company_id,
    );
    if (
      body.document.sale_perception &&
      !company.taxAgentSettings.perception_regimes.includes(body.document.sale_perception.regime)
    )
      throw AppError.validation("Company not enabled for this sale-perception regime", [], {
        httpStatus: 422,
      });
    validateCpeInput(
      body.document,
      body.document_type === "07" || body.document_type === "08" ? body.document_type : undefined,
    );
    if (body.document_type === "07")
      await this.credit.validate({ organizationId, body: body.document });
    if (body.document_type === "08")
      await this.debit.validate({ organizationId, body: body.document });
    if (body.document.prepayments?.length)
      await validatePrepayments(this.db, {
        organizationId,
        companyId: company.id,
        companyRuc: company.ruc,
        currency: body.document.currency,
        customer: body.document.customer,
        prepayments: body.document.prepayments,
      });
    const options = { supplier: supplierParty(company), number: 1 };
    try {
      if (body.document_type === "07" || body.document_type === "08") {
        const canonical = hydrateNoteFromFixtureRequest(body.document, body.document_type, options);
        const builder =
          body.document_type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder();
        return { canonical, xml: builder.build(canonical).xml };
      }
      const canonical = hydrateFromFixtureRequest(
        {
          ...body.document,
          document_type: body.document_type,
          totals_mode: body.document.totals_mode ?? "auto",
        },
        options,
      );
      return { canonical, xml: new XmlInvoiceBuilder().build(canonical).xml };
    } catch (error) {
      if (error instanceof AppError)
        throw AppError.validation(error.message, error.details, { httpStatus: 422 });
      throw error;
    }
  }

  async validate(organizationId: string, body: PreviewCreate) {
    const { canonical } = await this.build(organizationId, body);
    return {
      preview: true,
      signed: false,
      sent_to_sunat: false,
      numbering_reserved: false,
      reference_number: 1,
      document_type: body.document_type,
      totals: canonical.totals ?? {},
      validation: "local_business_rules",
      sunat_acceptance: "not_checked",
    };
  }

  async xml(organizationId: string, body: PreviewCreate) {
    return (await this.build(organizationId, body)).xml;
  }

  async render(organizationId: string, body: PreviewCreate) {
    const count = this.active.get(organizationId) ?? 0;
    if (count >= 2 || this.activeTotal >= 4)
      throw new HttpException("Preview rendering busy; retry later", 429);
    this.active.set(organizationId, count + 1);
    this.activeTotal++;
    try {
      const { canonical, xml } = await this.build(organizationId, body);
      return await this.pdf.renderPreview(
        organizationId,
        body.document.company_id,
        canonical as unknown as Record<string, unknown>,
        "pdf_format" in body.document ? body.document.pdf_format : undefined,
        xml,
      );
    } finally {
      const remaining = (this.active.get(organizationId) ?? 1) - 1;
      if (remaining) this.active.set(organizationId, remaining);
      else this.active.delete(organizationId);
      this.activeTotal--;
    }
  }
}
