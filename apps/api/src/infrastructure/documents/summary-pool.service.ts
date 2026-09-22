import { Injectable } from "@nestjs/common";
import { AppError } from "@factosys/shared";

import { DocumentsService } from "./documents.service";

export interface SummaryPoolLine {
  documentId: string;
  documentType: "03" | "07" | "08";
  serieNumber: string;
  status: "1" | "2" | "3";
  customer: {
    identity_type: string;
    identity_number: string;
  };
  totals: {
    gravadas: number;
    exoneradas: number;
    inafectas: number;
    igv: number;
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
    lineOverrides?: Array<{
      document_id?: string;
      status?: "1" | "2" | "3";
    }>;
  }): Promise<SummaryPoolLine[]> {
    let rows =
      input.documentIds?.length
        ? await this.documents.listByIds(
            input.organizationId,
            input.companyId,
            input.documentIds,
          )
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
        rows = await this.documents.listByIds(
          input.organizationId,
          input.companyId,
          overrideIds,
        );
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
        throw AppError.validation("Invalid document type in RC pool", [
          { path: "document_ids", issue: `type ${row.documentType}` },
        ], { httpStatus: 422 });
      }
      const totals = (row.totals ?? {}) as Record<string, number>;
      const lineExtension =
        Number(totals.line_extension_amount ?? totals.gravadas ?? 0) || 0;
      const igv = Number(totals.tax_amount ?? totals.igv ?? 0) || 0;
      const payable =
        Number(totals.payable_amount ?? totals.payable ?? lineExtension + igv) ||
        0;

      let affectedDocument: SummaryPoolLine["affectedDocument"];
      if (docType === "07" || docType === "08") {
        const payload = (row.payload ?? {}) as {
          affected_document?: { document_type?: string; serie_number?: string };
        };
        if (
          payload.affected_document?.document_type &&
          payload.affected_document?.serie_number
        ) {
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
          gravadas: lineExtension,
          exoneradas: 0,
          inafectas: 0,
          igv,
          payable,
        },
        affectedDocument,
      };
    });
  }
}
