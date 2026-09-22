import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppError } from "@factosys/shared";
import {
  buildQrPayload,
  createPdfRenderer,
  extractDigestValue,
  type PdfDocumentType,
  type PdfRenderInput,
  type PdfRendererPort,
} from "@factosys/pdf-ri";

import type { Env } from "../config/env.schema";
import { CompaniesService } from "../companies/companies.service";
import { DocumentsService } from "../documents/documents.service";
import { QueueProducer } from "../queues/queue.producer";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";

const PDF_TYPES = new Set(["01", "03", "07", "08"]);

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly renderer: PdfRendererPort;
  private readonly mode: "fake" | "playwright";

  constructor(
    private readonly documents: DocumentsService,
    private readonly companies: CompaniesService,
    private readonly queues: QueueProducer,
    config: ConfigService<Env, true>,
  ) {
    this.mode = config.get("PDF_RI_MODE", { infer: true });
    this.renderer = createPdfRenderer(this.mode);
  }

  async getOrRender(
    organizationId: string,
    documentId: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    const doc = await this.documents.getById(organizationId, documentId);
    if (!PDF_TYPES.has(doc.documentType)) {
      throw AppError.validation("PDF not applicable to this document type", [
        { path: "document_type", issue: doc.documentType },
      ]);
    }

    try {
      const existing = await this.documents.getArtifact(
        organizationId,
        documentId,
        "pdf",
      );
      return { body: existing.body, contentType: "application/pdf" };
    } catch {
      // lazy render
    }

    if (this.mode === "fake") {
      const body = await this.renderAndStore(organizationId, documentId);
      return { body, contentType: "application/pdf" };
    }

    await this.queues.enqueue(
      "pdf-render",
      {
        organizationId,
        companyId: doc.companyId,
        documentId,
      },
      { jobId: `pdf-${documentId}` },
    );

    // Short poll for worker completion
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try {
        const art = await this.documents.getArtifact(
          organizationId,
          documentId,
          "pdf",
        );
        return { body: art.body, contentType: "application/pdf" };
      } catch {
        // continue
      }
    }

    // Fallback sync render if worker is slow
    this.logger.warn(`PDF poll timeout for ${documentId}; rendering sync`);
    const body = await this.renderAndStore(organizationId, documentId);
    return { body, contentType: "application/pdf" };
  }

  async renderAndStore(
    organizationId: string,
    documentId: string,
  ): Promise<Buffer> {
    const doc = await this.documents.getById(organizationId, documentId);
    if (!PDF_TYPES.has(doc.documentType)) {
      throw AppError.validation("PDF not applicable to this document type", [
        { path: "document_type", issue: doc.documentType },
      ]);
    }

    const xmlArt = await this.documents.getArtifact(
      organizationId,
      documentId,
      "xml_signed",
    );
    const signedXml = xmlArt.body.toString("utf8");
    const digest = extractDigestValue(signedXml);
    if (!digest) {
      throw AppError.internal("Signed XML missing DigestValue");
    }

    const company = await this.companies.requireCompany(
      organizationId,
      doc.companyId,
    );

    const serie = doc.serie ?? doc.serieNumber?.split("-")[0] ?? "";
    const number =
      doc.number != null
        ? String(doc.number)
        : (doc.serieNumber?.split("-")[1] ?? "");
    const totals = (doc.totals ?? {}) as Record<string, unknown>;
    const igv = String(totals["igv"] ?? totals["tax"] ?? "0.00");
    const total = String(
      totals["total"] ?? totals["payable"] ?? totals["TaxInclusiveAmount"] ?? "0.00",
    );
    const gravado = totals["gravado"] != null ? String(totals["gravado"]) : undefined;

    const payload = (doc.payload ?? {}) as Record<string, unknown>;
    const linesRaw = Array.isArray(payload["lines"])
      ? (payload["lines"] as Record<string, unknown>[])
      : Array.isArray(payload["items"])
        ? (payload["items"] as Record<string, unknown>[])
        : [];

    const lines = linesRaw.length
      ? linesRaw.map((l) => ({
          description: String(l["description"] ?? l["name"] ?? "Item"),
          quantity: String(l["quantity"] ?? "1"),
          unit: String(l["unit_code"] ?? l["unit"] ?? "NIU"),
          unitPrice: String(l["unit_price"] ?? l["price"] ?? "0"),
          igv: String(l["igv"] ?? "0"),
          amount: String(l["amount"] ?? l["line_total"] ?? "0"),
        }))
      : [
          {
            description: "Ver XML firmado",
            quantity: "1",
            unit: "NIU",
            unitPrice: total,
            igv,
            amount: total,
          },
        ];

    const qrPayload = buildQrPayload({
      ruc: company.ruc,
      documentType: doc.documentType,
      serie,
      number,
      igv,
      total,
      issueDate: doc.issueDate ?? "",
      customerIdentityType: doc.customerIdentityType ?? "",
      customerIdentityNumber: doc.customerIdentityNumber ?? "",
      digestValue: digest,
    });

    const input: PdfRenderInput = {
      documentType: doc.documentType as PdfDocumentType,
      serieNumber: doc.serieNumber ?? `${serie}-${number}`,
      issueDate: doc.issueDate ?? "",
      currency: doc.currency ?? "PEN",
      issuer: {
        ruc: company.ruc,
        legalName: company.legalName,
      },
      customer: {
        identityType: doc.customerIdentityType ?? "",
        identityNumber: doc.customerIdentityNumber ?? "",
        name: doc.customerName ?? "",
      },
      lines,
      totals: { gravado, igv, total },
      digestValue: digest,
      qrPayload,
    };

    const bytes = await this.renderer.render(input);
    const body = Buffer.from(bytes);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const objectKey = buildDocumentObjectKey({
      organizationId,
      companyId: doc.companyId,
      documentId,
      kind: "pdf",
      sha256,
      ext: "pdf",
    });

    await this.documents.putArtifact({
      organizationId,
      companyId: doc.companyId,
      documentId,
      kind: "pdf",
      body,
      contentType: "application/pdf",
      objectKey,
    });

    return body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
