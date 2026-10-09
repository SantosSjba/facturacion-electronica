import type { InvoiceCanonical, SummaryLineTotalsCanonical } from "@factosys/sunat-ubl";
import { Injectable } from "@nestjs/common";
import { AppError } from "@factosys/shared";

import { DocumentsService } from "./documents.service";

export interface SummaryPoolLine {
  perception?: InvoiceCanonical["sale_perception"];
  documentId: string;
  documentType: "03" | "07" | "08";
  serieNumber: string;
  status: "1" | "2" | "3";
  customer: {
    identity_type: string;
    identity_number: string;
  };
  totals: {
    tax_groups?: SummaryLineTotalsCanonical["tax_groups"];
    gravadas: number;
    exoneradas: number;
    inafectas: number;
    gratuitas?: number;
    igv: number;
    isc?: number;
    ivap?: number;
    icbper?: number;
    other_charges?: number;
    payable: number;
  };
  affectedDocument?: {
    document_type: string;
    serie_number: string;
  };
}

/**
 * Selects boletas/NC/ND eligible for RC auto-pool (dict 20).
 */
@Injectable()
export class SummaryPoolService {
  constructor(private readonly documents: DocumentsService) {}

  async resolvePool(input: {
    organizationId: string;
    companyId: string;
    referenceDate: string;
    documentIds?: string[];
    lineOverrides?: {
      document_id?: string;
      status?: "1" | "2" | "3";
    }[];
  }): Promise<SummaryPoolLine[]> {
    let rows = input.documentIds?.length
      ? await this.documents.listByIds(input.organizationId, input.companyId, input.documentIds)
      : await this.documents.listPendingSummaryPool({
          organizationId: input.organizationId,
          companyId: input.companyId,
          referenceDate: input.referenceDate,
        });

    if (input.lineOverrides?.length && !input.documentIds?.length) {
      const overrideIds = input.lineOverrides
        .map((l) => l.document_id)
        .filter((id): id is string => Boolean(id));
      if (overrideIds.length) {
        rows = await this.documents.listByIds(input.organizationId, input.companyId, overrideIds);
      }
    }

    if (!rows.length) {
      throw AppError.validation(
        "No documents in daily summary pool for reference_date",
        [{ path: "reference_date", issue: "empty pool" }],
        { httpStatus: 422 },
      );
    }

    const overrideStatus = new Map<string, "1" | "2" | "3">();
    for (const line of input.lineOverrides ?? []) {
      if (line.document_id && line.status) {
        overrideStatus.set(line.document_id, line.status);
      }
    }

    return rows.map((row) => {
      const docType = row.documentType as "03" | "07" | "08";
      if (!["03", "07", "08"].includes(docType)) {
        throw AppError.validation(
          "Invalid document type in RC pool",
          [{ path: "document_ids", issue: `type ${row.documentType}` }],
          { httpStatus: 422 },
        );
      }
      const totals = (row.totals ?? {}) as Record<string, number>;
      if ((row.currency && row.currency !== "PEN") || Number(totals.export_amount ?? 0) > 0) {
        throw AppError.validation(
          "RC does not yet support foreign currency or export",
          [{ path: "document_ids", issue: row.id }],
          { httpStatus: 422 },
        );
      }
      const lineExtension = Number(totals.line_extension_amount ?? totals.gravadas ?? 0) || 0;
      const igv =
        totals.igv_amount ??
        Number(totals.tax_amount ?? totals.igv ?? 0) - Number(totals.free_tax_amount ?? 0);
      const nonTaxAdjustments = (
        row.payload as
          | {
              _canonical?: {
                lines?: { adjustments?: { code: string; amount: number }[] }[];
                adjustments?: { code: string; amount: number }[];
              };
            }
          | undefined
      )?._canonical;
      const adjustments = [
        ...(nonTaxAdjustments?.adjustments ?? []),
        ...(nonTaxAdjustments?.lines ?? []).flatMap((l) => l.adjustments ?? []),
      ];
      const otherCharges = adjustments
        .filter((a) => ["46", "48", "50"].includes(a.code))
        .reduce((sum, a) => sum + a.amount, 0);
      const otherDiscounts = adjustments
        .filter((a) => ["01", "03"].includes(a.code))
        .reduce((sum, a) => sum + a.amount, 0);
      if (otherDiscounts)
        throw AppError.validation(
          "Non-tax discounts require individual emission",
          [{ path: "document_ids", issue: row.id }],
          { httpStatus: 422 },
        );
      const canonical = (row.payload as { _canonical?: InvoiceCanonical } | undefined)?._canonical;
      const taxGroups = canonical?.totals.tax_subtotals
        .filter((g) => ["1000", "1016", "2000", "7152"].includes(g.tax_scheme_id))
        .map((g) => ({
          scheme_id: g.tax_scheme_id,
          name: g.tax_scheme_name,
          type_code:
            g.tax_scheme_id === "2000" ? "EXC" : g.tax_scheme_id === "7152" ? "OTH" : "VAT",
          percent: g.percent,
          amount: g.tax_amount,
        }));
      if (taxGroups && !taxGroups.some((g) => ["1000", "1016"].includes(g.scheme_id)))
        taxGroups.unshift({
          scheme_id: "1000",
          name: "IGV",
          type_code: "VAT",
          percent: 18,
          amount: 0,
        });
      const payable =
        Number(
          canonical?.sale_perception?.base_amount ??
            totals.payable_amount ??
            totals.payable ??
            lineExtension + igv,
        ) || 0;

      let affectedDocument: SummaryPoolLine["affectedDocument"];
      if (docType === "07" || docType === "08") {
        const payload = (row.payload ?? {}) as {
          affected_document?: { document_type?: string; serie_number?: string };
        };
        if (payload.affected_document?.document_type && payload.affected_document?.serie_number) {
          affectedDocument = {
            document_type: payload.affected_document.document_type,
            serie_number: payload.affected_document.serie_number,
          };
        }
      }

      return {
        documentId: row.id,
        documentType: docType,
        serieNumber: row.serieNumber ?? `${row.serie}-${row.number}`,
        status: overrideStatus.get(row.id) ?? "1",
        customer: {
          identity_type: row.customerIdentityType ?? "1",
          identity_number: row.customerIdentityNumber ?? "00000000",
        },
        totals: {
          tax_groups: taxGroups,
          gravadas: Number(totals.taxed_amount ?? lineExtension),
          exoneradas: Number(totals.exempt_amount ?? 0),
          inafectas: Number(totals.unaffected_amount ?? 0),
          gratuitas: Number(totals.free_amount ?? 0),
          igv,
          isc: Number(totals.isc_amount ?? 0),
          ivap: Number(totals.ivap_amount ?? 0),
          icbper: Number(totals.icbper_amount ?? 0),
          other_charges: otherCharges,
          payable,
        },
        affectedDocument,
        perception: canonical?.sale_perception,
      };
    });
  }
}
