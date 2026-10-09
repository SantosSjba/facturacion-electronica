import { commercialSections, commercialLineDetails } from "./commercial-pdf";
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
import { CompanyLogoService } from "../companies/company-logo.service";
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
    private readonly logos: CompanyLogoService,
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
      const existing = await this.documents.getArtifact(organizationId, documentId, "pdf");
      // Re-render when switching from Fake → Playwright (cached stub would stick).
      if (this.mode === "playwright" && isFakeRiPdf(existing.body)) {
        this.logger.log(`Replacing Fake RI PDF for ${documentId} with Playwright render`);
      } else {
        return { body: existing.body, contentType: "application/pdf" };
      }
    } catch {
      // lazy render
    }

    if (this.mode === "fake") {
      const body = await this.renderAndStore(organizationId, documentId);
      return { body, contentType: "application/pdf" };
    }

    // Prefer sync Playwright render on download so local/dev does not depend
    // on the pdf-render worker being idle. Still enqueue for background warm-up.
    try {
      const body = await this.renderAndStore(organizationId, documentId);
      return { body, contentType: "application/pdf" };
    } catch (err) {
      this.logger.warn(
        `Sync Playwright PDF failed for ${documentId}; enqueueing worker: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
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

    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const art = await this.documents.getArtifact(organizationId, documentId, "pdf");
        if (!isFakeRiPdf(art.body)) {
          return { body: art.body, contentType: "application/pdf" };
        }
      } catch {
        // continue
      }
    }

    throw AppError.internal(
      "PDF RI no pudo generarse. Verifica PDF_RI_MODE=playwright y que Chromium de Playwright esté instalado (`pnpm exec playwright install chromium`).",
    );
  }

  async renderAndStore(organizationId: string, documentId: string): Promise<Buffer> {
    const doc = await this.documents.getById(organizationId, documentId);
    if (!PDF_TYPES.has(doc.documentType)) {
      throw AppError.validation("PDF not applicable to this document type", [
        { path: "document_type", issue: doc.documentType },
      ]);
    }

    // Background retries must also preserve a previously generated PDF.
    try {
      const existing = await this.documents.getArtifact(organizationId, documentId, "pdf");
      if (!(this.mode === "playwright" && isFakeRiPdf(existing.body))) return existing.body;
    } catch {
      // No stored PDF yet; continue rendering.
    }

    const xmlArt = await this.documents.getArtifact(organizationId, documentId, "xml_signed");
    const signedXml = xmlArt.body.toString("utf8");
    const digest = extractDigestValue(signedXml);
    if (!digest) {
      throw AppError.internal("Signed XML missing DigestValue");
    }

    const company = await this.companies.requireCompany(organizationId, doc.companyId);
    const documentLogo = doc.logoSnapshot ? doc.logoSnapshot.logo : company.logo;

    const serie = doc.serie ?? doc.serieNumber?.split("-")[0] ?? "";
    const number = doc.number != null ? String(doc.number) : (doc.serieNumber?.split("-")[1] ?? "");
    const totals = (doc.totals ?? {}) as Record<string, unknown>;
    const payload = (doc.payload ?? {}) as Record<string, unknown>;
    const snapshot = payload["_canonical"] as Record<string, unknown> | undefined;
    const snapshotSupplier = snapshot?.["supplier"] as Record<string, unknown> | undefined;
    const snapshotCustomer = snapshot?.["customer"] as Record<string, unknown> | undefined;
    const igv = moneyStr(
      (snapshot
        ? Number(
            totals["igv_amount"] ??
              Number(totals["tax_amount"] ?? 0) - Number(totals["free_tax_amount"] ?? 0),
          )
        : undefined) ??
        totals["tax_amount"] ??
        totals["total_igv"] ??
        totals["igv"] ??
        totals["tax"],
    );
    const total = moneyStr(
      totals["payable_amount"] ??
        totals["total_payable"] ??
        totals["tax_inclusive_amount"] ??
        totals["total"] ??
        totals["payable"] ??
        totals["TaxInclusiveAmount"],
    );
    const gravado = moneyStr(
      totals["taxed_amount"] ??
        totals["line_extension_amount"] ??
        totals["total_taxed"] ??
        totals["gravado"],
      undefined,
    );

    const linesRaw = Array.isArray(snapshot?.["lines"])
      ? (snapshot["lines"] as Record<string, unknown>[])
      : Array.isArray(payload["lines"])
        ? (payload["lines"] as Record<string, unknown>[])
        : Array.isArray(payload["items"])
          ? (payload["items"] as Record<string, unknown>[])
          : [];

    const lines = linesRaw.length
      ? linesRaw.map((l) => {
          const qty = Number(l["quantity"] ?? 1) || 1;
          const unitValue = Number(l["unit_value"] ?? l["unit_price"] ?? l["price"] ?? 0);
          const lineExt =
            (snapshot
              ? Number(l["line_extension_amount"]) +
                (l["is_free"] ? Number(l["icbper_amount"] ?? 0) : Number(l["tax_amount"])) +
                ((l["adjustments"] ?? []) as { code: string; amount: number }[]).reduce(
                  (sum, a) =>
                    sum + (["48"].includes(a.code) ? a.amount : a.code === "01" ? -a.amount : 0),
                  0,
                )
              : undefined) ??
            l["line_extension_amount"] ??
            l["amount"] ??
            l["line_total"] ??
            unitValue * qty;
          const lineIgv = l["igv_amount"] ?? l["tax_amount"] ?? l["igv"] ?? 0;
          return {
            description: String(l["description"] ?? l["name"] ?? "Item"),
            productCode: typeof l["product_code"] === "string" ? l["product_code"] : undefined,
            sunatProductCode:
              typeof l["sunat_product_code"] === "string" ? l["sunat_product_code"] : undefined,
            quantity: String(l["quantity"] ?? "1"),
            unit: String(l["unit_code"] ?? l["unit"] ?? "NIU"),
            unitPrice: moneyStr(l["unit_price"] ?? unitValue),
            igv: moneyStr(lineIgv),
            amount: moneyStr(lineExt),
            details: commercialLineDetails(l),
            isc: nonzeroMoney(l["isc_amount"]),
            icbper: nonzeroMoney(l["icbper_amount"]),
          };
        })
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
      ruc: String(snapshotSupplier?.["identity_number"] ?? company.ruc),
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
      issueTime: snapshot?.["issue_time"] as string | undefined,
      dueDate: snapshot?.["due_date"] as string | undefined,
      purchaseOrder: snapshot?.["purchase_order"] as string | undefined,
      legends: snapshot?.["legends"] as PdfRenderInput["legends"],
      noteReason: snapshot?.["reason"] as string | undefined,
      affectedSerieNumber: (
        snapshot?.["affected_document"] as Record<string, string> | undefined
      )?.["serie_number"],
      currency: String(snapshot?.["currency"] ?? doc.currency ?? "PEN"),
      commercialSections: commercialSections(snapshot),
      issuer: {
        ruc: String(snapshotSupplier?.["identity_number"] ?? company.ruc),
        legalName: String(snapshotSupplier?.["name"] ?? company.legalName),
        address: addressLine(snapshot ? snapshotSupplier?.["address"] : company.address),
        logoDataUrl: documentLogo ? await this.logos.getDataUrl(documentLogo) : undefined,
      },
      customer: {
        identityType: String(snapshotCustomer?.["identity_type"] ?? doc.customerIdentityType ?? ""),
        identityNumber: String(
          snapshotCustomer?.["identity_number"] ?? doc.customerIdentityNumber ?? "",
        ),
        name: String(snapshotCustomer?.["name"] ?? doc.customerName ?? ""),
        address: addressLine(snapshotCustomer?.["address"]),
        email: snapshotCustomer?.["email"] as string | undefined,
      },
      lines,
      totals: {
        gravado,
        igv,
        total,
        exempt: nonzeroMoney(totals["exempt_amount"]),
        unaffected: nonzeroMoney(totals["unaffected_amount"]),
        export: nonzeroMoney(totals["export_amount"]),
        free: nonzeroMoney(totals["free_amount"]),
        freeTax: nonzeroMoney(totals["free_tax_amount"]),
        ivap: nonzeroMoney(totals["ivap_amount"]),
        isc: nonzeroMoney(totals["isc_amount"]),
        icbper: nonzeroMoney(totals["icbper_amount"]),
        prepaid: nonzeroMoney(totals["prepaid_amount"]),
        gross: moneyStr(
          Number(totals["payable_amount"] ?? 0) + Number(totals["prepaid_amount"] ?? 0),
        ),
        discounts: nonzeroMoney(totals["allowance_total_amount"]),
        charges: nonzeroMoney(totals["charge_total_amount"]),
      },
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

function isFakeRiPdf(body: Buffer): boolean {
  return body.toString("latin1").includes("Factosys RI Fake PDF");
}

function moneyStr(value: unknown, fallback = "0.00"): string {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

function addressLine(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const addr = value as Record<string, unknown>;
  const parts = [addr["line"], addr["district"], addr["province"], addr["department"]].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return parts.length ? parts.join(", ") : undefined;
}

function nonzeroMoney(value: unknown): string | undefined {
  return Number(value) > 0 ? moneyStr(value) : undefined;
}
