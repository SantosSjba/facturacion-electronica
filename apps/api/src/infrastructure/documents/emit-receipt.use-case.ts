import { Injectable } from "@nestjs/common";
import {
  hydrateFromFixtureRequest,
  XmlInvoiceBuilder,
  type InvoiceFixtureRequest,
} from "@factosys/sunat-ubl";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import { packInvoiceZip } from "@factosys/sunat-soap";

import type { ReceiptCreate } from "../../interfaces/http/dto/receipt-create.schema";
import { EmitDocumentOrchestrator } from "./emit-document.orchestrator";
import type { DocumentPublic } from "./documents.service";

@Injectable()
export class EmitReceiptUseCase {
  constructor(private readonly orchestrator: EmitDocumentOrchestrator) {}

  async execute(input: {
    organizationId: string;
    body: ReceiptCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    return this.orchestrator.execute({
      organizationId: input.organizationId,
      companyId: input.body.company_id,
      documentType: "03",
      serie: input.body.serie,
      issueDate: input.body.issue_date,
      currency: input.body.currency,
      customer: input.body.customer,
      payload: input.body,
      idempotencyKey: input.idempotencyKey,
      build: async ({ company, allocated, pfx, password }) => {
        const fixtureRequest: InvoiceFixtureRequest = {
          company_id: company.id,
          document_type: "03",
          serie: input.body.serie.toUpperCase(),
          operation_type: input.body.operation_type,
          issue_date: input.body.issue_date,
          currency: input.body.currency,
          totals_mode: input.body.totals_mode ?? "auto",
          customer: {
            identity_type: input.body.customer.identity_type,
            identity_number: input.body.customer.identity_number,
            name: input.body.customer.name,
          },
          lines: input.body.lines.map((l) => ({
            id: l.id,
            quantity: l.quantity,
            unit_code: l.unit_code,
            description: l.description,
            unit_value: l.unit_value,
            unit_price: l.unit_price,
            tax_affectation: l.tax_affectation,
            igv_percent: l.igv_percent,
            tax_scheme_id: l.tax_scheme_id,
          })),
        };

        const canonical = hydrateFromFixtureRequest(fixtureRequest, {
          supplier: {
            identity_type: "6",
            identity_number: company.ruc,
            name: company.legalName,
          },
          number: allocated.number,
        });

        const { xml } = new XmlInvoiceBuilder().build(canonical);
        const { signedXml } = await new XmlCryptoSignAdapter().sign({
          xml,
          certificate: pfx,
          password,
        });
        const packed = packInvoiceZip({
          ruc: company.ruc,
          documentType: "03",
          serie: canonical.serie,
          number: canonical.number,
          xml: signedXml,
        });

        return {
          serie: canonical.serie,
          number: canonical.number,
          padded: allocated.padded,
          totals: canonical.totals as unknown as Record<string, unknown>,
          signedXml,
          zipBytes: packed.zipBytes,
        };
      },
    });
  }
}
