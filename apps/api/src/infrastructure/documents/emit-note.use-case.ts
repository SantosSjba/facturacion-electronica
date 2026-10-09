import { validateCpeInput, supplierParty } from "./cpe-input";
import { Injectable } from "@nestjs/common";
import {
  hydrateNoteFromFixtureRequest,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
  type NoteFixtureRequest,
} from "@factosys/sunat-ubl";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import { packInvoiceZip } from "@factosys/sunat-soap";
import { AppError } from "@factosys/shared";

import type { CreditNoteCreate } from "../../interfaces/http/dto/credit-note-create.schema";
import type { DebitNoteCreate } from "../../interfaces/http/dto/debit-note-create.schema";
import { EmitDocumentOrchestrator } from "./emit-document.orchestrator";
import { DocumentsService, type DocumentPublic } from "./documents.service";

@Injectable()
export class EmitCreditNoteUseCase {
  constructor(
    private readonly orchestrator: EmitDocumentOrchestrator,
    private readonly documents: DocumentsService,
  ) {}

  async execute(input: {
    organizationId: string;
    body: CreditNoteCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    const affected = await this.documents.requireAcceptedAffected({
      organizationId: input.organizationId,
      companyId: input.body.company_id,
      documentType: input.body.affected_document.document_type,
      serieNumber: input.body.affected_document.serie_number,
    });

    this.assertSerieFamily(input.body.serie, affected.documentType);
    if (
      affected.currency &&
      (affected.currency !== input.body.currency ||
        affected.customerIdentityType !== input.body.customer.identity_type ||
        affected.customerIdentityNumber !== input.body.customer.identity_number)
    )
      throw AppError.validation(
        "Note currency/customer must match affected document",
        [{ path: "affected_document", issue: "currency or customer mismatch" }],
        { httpStatus: 422 },
      );
    if (input.body.issue_date < (affected.issueDate ?? ""))
      throw AppError.validation(
        "Note cannot precede affected document",
        [{ path: "issue_date", issue: "before affected issue date" }],
        { httpStatus: 422 },
      );

    if (
      input.body.note_type === "13" &&
      (affected.payload as { _canonical?: { payment_terms?: { condition?: string } } } | undefined)
        ?._canonical?.payment_terms?.condition !== "credit"
    )
      throw AppError.validation(
        "Quota correction requires an accepted credit invoice",
        [{ path: "affected_document", issue: "original is not credit" }],
        { httpStatus: 422 },
      );
    validateCpeInput(input.body, "07");
    const originalTotal = Number(
      (affected.totals as { payable_amount?: number } | undefined)?.payable_amount,
    );
    const noteTotal = hydrateNoteFromFixtureRequest({ ...input.body }, "07").totals.payable_amount;
    const correctedBalance =
      input.body.payment_terms?.condition === "credit"
        ? input.body.payment_terms.outstanding_amount
        : 0;
    if (
      Number.isFinite(originalTotal) &&
      (noteTotal > originalTotal || correctedBalance > originalTotal)
    )
      throw AppError.validation(
        "Credit note cannot exceed the affected document amount",
        [
          {
            path: input.body.note_type === "13" ? "payment_terms.outstanding_amount" : "lines",
            issue: "exceeds original amount",
          },
        ],
        { httpStatus: 422 },
      );
    return this.orchestrator.execute({
      organizationId: input.organizationId,
      companyId: input.body.company_id,
      documentType: "07",
      serie: input.body.serie,
      issueDate: input.body.issue_date,
      currency: input.body.currency,
      customer: input.body.customer,
      payload: input.body,
      idempotencyKey: input.idempotencyKey,
      relatedDocumentId: affected.id,
      build: async ({ company, allocated, pfx, password }) => {
        const noteRequest: NoteFixtureRequest = {
          ...input.body,
          company_id: company.id,
          document_type: "07",
          serie: input.body.serie.toUpperCase(),
          issue_date: input.body.issue_date,
          currency: input.body.currency,
          note_type: input.body.note_type,
          reason: input.body.reason,
          affected_document: {
            document_type: input.body.affected_document.document_type,
            serie_number: input.body.affected_document.serie_number,
          },
          totals_mode: input.body.totals_mode ?? "auto",
          customer: input.body.customer,
          lines: input.body.lines,
        };

        const canonical = hydrateNoteFromFixtureRequest(noteRequest, "07", {
          supplier: supplierParty(company),
          number: allocated.number,
        });

        const { xml } = new XmlCreditNoteBuilder().build(canonical);
        const { signedXml } = await new XmlCryptoSignAdapter().sign({
          xml,
          certificate: pfx,
          password,
        });
        const packed = packInvoiceZip({
          ruc: company.ruc,
          documentType: "07",
          serie: canonical.serie,
          number: canonical.number,
          xml: signedXml,
        });

        return {
          serie: canonical.serie,
          number: canonical.number,
          padded: allocated.padded,
          canonicalSnapshot: canonical as unknown as Record<string, unknown>,
          totals: canonical.totals as unknown as Record<string, unknown>,
          signedXml,
          zipBytes: packed.zipBytes,
          relatedDocumentId: affected.id,
        };
      },
    });
  }

  private assertSerieFamily(serie: string, affectedType: string): void {
    const s = serie.toUpperCase();
    if (affectedType === "01" && !s.startsWith("F")) {
      throw AppError.validation(
        "NC serie must match affected factura family (F###)",
        [{ path: "serie", issue: "must start with F for affected 01" }],
        { httpStatus: 422 },
      );
    }
    if (affectedType === "03" && !s.startsWith("B")) {
      throw AppError.validation(
        "NC serie must match affected boleta family (B###)",
        [{ path: "serie", issue: "must start with B for affected 03" }],
        { httpStatus: 422 },
      );
    }
  }
}

@Injectable()
export class EmitDebitNoteUseCase {
  constructor(
    private readonly orchestrator: EmitDocumentOrchestrator,
    private readonly documents: DocumentsService,
  ) {}

  async execute(input: {
    organizationId: string;
    body: DebitNoteCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    const affected = await this.documents.requireAcceptedAffected({
      organizationId: input.organizationId,
      companyId: input.body.company_id,
      documentType: input.body.affected_document.document_type,
      serieNumber: input.body.affected_document.serie_number,
    });

    this.assertSerieFamily(input.body.serie, affected.documentType);
    if (
      affected.currency &&
      (affected.currency !== input.body.currency ||
        affected.customerIdentityType !== input.body.customer.identity_type ||
        affected.customerIdentityNumber !== input.body.customer.identity_number)
    )
      throw AppError.validation(
        "Note currency/customer must match affected document",
        [{ path: "affected_document", issue: "currency or customer mismatch" }],
        { httpStatus: 422 },
      );
    if (input.body.issue_date < (affected.issueDate ?? ""))
      throw AppError.validation(
        "Note cannot precede affected document",
        [{ path: "issue_date", issue: "before affected issue date" }],
        { httpStatus: 422 },
      );

    validateCpeInput(input.body, "08");
    return this.orchestrator.execute({
      organizationId: input.organizationId,
      companyId: input.body.company_id,
      documentType: "08",
      serie: input.body.serie,
      issueDate: input.body.issue_date,
      currency: input.body.currency,
      customer: input.body.customer,
      payload: input.body,
      idempotencyKey: input.idempotencyKey,
      relatedDocumentId: affected.id,
      build: async ({ company, allocated, pfx, password }) => {
        const noteRequest: NoteFixtureRequest = {
          ...input.body,
          company_id: company.id,
          document_type: "08",
          serie: input.body.serie.toUpperCase(),
          issue_date: input.body.issue_date,
          currency: input.body.currency,
          note_type: input.body.note_type,
          reason: input.body.reason,
          affected_document: {
            document_type: input.body.affected_document.document_type,
            serie_number: input.body.affected_document.serie_number,
          },
          totals_mode: input.body.totals_mode ?? "auto",
          customer: input.body.customer,
          lines: input.body.lines,
        };

        const canonical = hydrateNoteFromFixtureRequest(noteRequest, "08", {
          supplier: supplierParty(company),
          number: allocated.number,
        });

        const { xml } = new XmlDebitNoteBuilder().build(canonical);
        const { signedXml } = await new XmlCryptoSignAdapter().sign({
          xml,
          certificate: pfx,
          password,
        });
        const packed = packInvoiceZip({
          ruc: company.ruc,
          documentType: "08",
          serie: canonical.serie,
          number: canonical.number,
          xml: signedXml,
        });

        return {
          serie: canonical.serie,
          number: canonical.number,
          padded: allocated.padded,
          canonicalSnapshot: canonical as unknown as Record<string, unknown>,
          totals: canonical.totals as unknown as Record<string, unknown>,
          signedXml,
          zipBytes: packed.zipBytes,
          relatedDocumentId: affected.id,
        };
      },
    });
  }

  private assertSerieFamily(serie: string, affectedType: string): void {
    const s = serie.toUpperCase();
    if (affectedType === "01" && !s.startsWith("F")) {
      throw AppError.validation(
        "ND serie must match affected factura family (F###)",
        [{ path: "serie", issue: "must start with F for affected 01" }],
        { httpStatus: 422 },
      );
    }
    if (affectedType === "03" && !s.startsWith("B")) {
      throw AppError.validation(
        "ND serie must match affected boleta family (B###)",
        [{ path: "serie", issue: "must start with B for affected 03" }],
        { httpStatus: 422 },
      );
    }
  }
}
