import { taxAgentPdfInput } from "./tax-agent-pdf";
import { greQrUrl, grePdfInput } from "./gre-pdf";
import { commercialSections, commercialLineDetails } from "./commercial-pdf";
import { createHash } from "node:crypto";
import { formatUnit } from "@factosys/sunat-ubl";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppError } from "@factosys/shared";
import {
  buildQrPayload,
  buildQrImage,
  readSignedCpeQr,
  readSummaryXml,
  PDF_TEMPLATE_VERSION,
  type PdfFormat,
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

const CPE_TYPES = new Set(["01", "03", "07", "08", "20", "40"]);
const PDF_TYPES = new Set([...CPE_TYPES, "RC", "RA", "RR", "09", "31"]);

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

    if (["09", "31"].includes(doc.documentType)) greQrUrl(doc);

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

    if (["09", "31"].includes(doc.documentType)) greQrUrl(doc);

    // Background retries must also preserve a previously generated PDF.
    try {
      const existing = await this.documents.getArtifact(organizationId, documentId, "pdf");
      if (!(this.mode === "playwright" && isFakeRiPdf(existing.body))) return existing.body;
    } catch {
      // No stored PDF yet; continue rendering.
    }

    const input = await this.renderInput(organizationId, doc);

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

    const storedBody = await this.documents.putArtifact({
      organizationId,
      companyId: doc.companyId,
      documentId,
      kind: "pdf",
      body,
      contentType: "application/pdf",
      objectKey,
    });

    return storedBody ?? body;
  }
  async getQr(organizationId: string, documentId: string) {
    const doc = await this.documents.getById(organizationId, documentId);
    if (["09", "31"].includes(doc.documentType)) return buildQrImage(greQrUrl(doc));
    if (!CPE_TYPES.has(doc.documentType))
      throw AppError.validation("QR only applies to CPE", [], { httpStatus: 422 });
    const xml = (
      await this.documents.getArtifact(organizationId, documentId, "xml_signed")
    ).body.toString("utf8");
    const fiscal = readSignedCpeQr(xml);
    if (fiscal) return buildQrImage(buildQrPayload(fiscal));
    const input = await this.renderInput(organizationId, doc);
    return buildQrImage(input.qrPayload);
  }

  async renderPreview(
    organizationId: string,
    companyId: string,
    snapshot: Record<string, unknown>,
    format?: PdfFormat,
    unsignedXml?: string,
  ): Promise<Buffer> {
    const company = await this.companies.requireCompany(organizationId, companyId);
    const doc = {
      companyId,
      documentType: snapshot["document_type"],
      serie: snapshot["serie"],
      number: snapshot["number"],
      issueDate: snapshot["issue_date"],
      currency: snapshot["currency"],
      serieNumber: snapshot["id"],
      status: "preview",
      totals: snapshot["totals"],
      payload: {
        _canonical: snapshot,
        _print: {
          format: format ?? company.pdfFormat ?? "A4",
          template_version: PDF_TEMPLATE_VERSION,
        },
      },
      logoSnapshot: { logo: company.logo ?? null },
    } as Awaited<ReturnType<DocumentsService["getById"]>>;
    const input = await this.renderInput(organizationId, doc, "", unsignedXml);
    return Buffer.from(
      await this.renderer.render({ ...input, preview: true, digestValue: "", qrPayload: "" }),
    );
  }

  private summaryInput(
    doc: Awaited<ReturnType<DocumentsService["getById"]>>,
    company: { ruc: string; legalName: string },
    logoDataUrl?: string,
    signedXml?: string,
  ): PdfRenderInput {
    const payload = (doc.payload ?? {}) as Record<string, unknown>;
    const canonical = (payload["_canonical"] ?? readSummaryXml(signedXml ?? "")) as Record<
      string,
      unknown
    >;
    const supplier = canonical["supplier"] as Record<string, string>;
    const rows = canonical["lines"] as Record<string, unknown>[];
    return {
      documentType: doc.documentType as PdfDocumentType,
      informational: true,
      format: "A4",
      templateVersion: PDF_TEMPLATE_VERSION,
      serieNumber: String(canonical["id"] ?? doc.serieNumber),
      issueDate: String(canonical["issue_date"] ?? doc.issueDate),
      currency: doc.currency ?? "PEN",
      issuer: {
        ruc: supplier?.["identity_number"] ?? company.ruc,
        legalName: supplier?.["name"] ?? company.legalName,
        logoDataUrl,
      },
      customer: { identityType: "", identityNumber: "", name: "" },
      lines: rows.map((row) => ({
        description: `${row["document_type"]} ${row["serie_number"] ?? `${row["serie"]}-${row["number"]}`}`,
        quantity: "1",
        unit: "DOC",
        unitPrice: "",
        igv: "",
        amount: "",
        details: [
          ...(row["customer"]
            ? [
                `Adquirente: ${(row["customer"] as Record<string, string>)["identity_type"]} ${(row["customer"] as Record<string, string>)["identity_number"]}`,
              ]
            : []),
          row["reason"]
            ? `Motivo: ${row["reason"]}`
            : `Operación RC: ${{ "1": "Alta", "2": "Modificación", "3": "Baja" }[String(row["status"])] ?? row["status"]}`,
          ...(row["totals"]
            ? Object.entries(row["totals"] as Record<string, unknown>)
                .filter(([, value]) => typeof value === "number")
                .map(([key, value]) => `${key}: ${moneyStr(value)}`)
            : []),
          ...(row["affected_document"]
            ? [
                `Documento afectado: ${(row["affected_document"] as Record<string, string>)["serie_number"]}`,
              ]
            : []),
          ...(row["perception"]
            ? [
                `Percepción: ${moneyStr((row["perception"] as Record<string, unknown>)["amount"])}; total incluido: ${moneyStr((row["perception"] as Record<string, unknown>)["total_amount"])}`,
              ]
            : []),
        ],
      })),
      totals: { total: "" },
      digestValue: "",
      qrPayload: "",
      commercialSections: [
        {
          title: "Envío y resultado al generar este PDF",
          entries: [
            { label: "Fecha de referencia", value: String(canonical["reference_date"]) },
            { label: "Ticket SUNAT", value: doc.sunatTicket ?? "Pendiente" },
            { label: "Estado", value: doc.status },
            { label: "Código SUNAT", value: doc.sunatResponseCode ?? "Pendiente" },
            { label: "Resultado", value: doc.sunatResponseMessage ?? "Pendiente" },
          ],
        },
      ],
    };
  }

  private async renderInput(
    organizationId: string,
    doc: Awaited<ReturnType<DocumentsService["getById"]>>,
    previewDigest?: string,
    previewXml?: string,
  ): Promise<PdfRenderInput> {
    const signedXml =
      previewDigest === undefined
        ? (await this.documents.getArtifact(organizationId, doc.id, "xml_signed")).body.toString(
            "utf8",
          )
        : (previewXml ?? "");
    const digest = previewDigest ?? extractDigestValue(signedXml);
    if (digest === null) throw AppError.internal("Signed XML missing DigestValue");
    const company = await this.companies.requireCompany(organizationId, doc.companyId);
    const documentLogo = doc.logoSnapshot ? doc.logoSnapshot.logo : company.logo;
    if (["09", "31"].includes(doc.documentType))
      return grePdfInput(
        doc,
        documentLogo ? await this.logos.getDataUrl(documentLogo) : undefined,
        previewDigest !== undefined,
      );
    if (["20", "40"].includes(doc.documentType))
      return taxAgentPdfInput(
        doc,
        signedXml,
        documentLogo ? await this.logos.getDataUrl(documentLogo) : undefined,
        previewDigest !== undefined,
      );
    if (["RC", "RA", "RR"].includes(doc.documentType))
      return this.summaryInput(
        doc,
        company,
        documentLogo ? await this.logos.getDataUrl(documentLogo) : undefined,
        signedXml,
      );

    const serie = doc.serie ?? doc.serieNumber?.split("-")[0] ?? "";
    const number = doc.number != null ? String(doc.number) : (doc.serieNumber?.split("-")[1] ?? "");

    const payload = (doc.payload ?? {}) as Record<string, unknown>;
    const snapshot = payload["_canonical"] as Record<string, unknown> | undefined;
    const fiscalSerie = String(snapshot?.["serie"] ?? serie);
    const fiscalNumber = snapshot ? String(snapshot["number"] ?? number).padStart(8, "0") : number;
    const totals = (snapshot?.["totals"] ?? doc.totals ?? {}) as Record<string, unknown>;
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
            unitPrice: unitMoneyStr(l["unit_price"] ?? unitValue),
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

    const xmlQr = previewDigest === undefined && signedXml ? readSignedCpeQr(signedXml) : null;
    const qrPayload = buildQrPayload(
      xmlQr ?? {
        ruc: String(snapshotSupplier?.["identity_number"] ?? company.ruc),
        documentType: doc.documentType,
        serie: fiscalSerie,
        number: fiscalNumber,
        igv,
        total,
        issueDate: String(snapshot?.["issue_date"] ?? doc.issueDate ?? ""),
        customerIdentityType: String(
          snapshotCustomer?.["identity_type"] ?? doc.customerIdentityType ?? "",
        ),
        customerIdentityNumber: String(
          snapshotCustomer?.["identity_number"] ?? doc.customerIdentityNumber ?? "",
        ),
        digestValue: digest,
      },
    );

    const print = payload["_print"] as
      { format?: PdfFormat; template_version?: string } | undefined;
    const input: PdfRenderInput = {
      format: print?.format ?? "A4",
      templateVersion: print?.template_version ?? PDF_TEMPLATE_VERSION,
      observations: snapshot?.["observations"] as string | undefined,
      documentType: doc.documentType as PdfDocumentType,
      serieNumber: snapshot
        ? `${fiscalSerie}-${fiscalNumber}`
        : (doc.serieNumber ?? `${serie}-${number}`),
      issueDate: String(snapshot?.["issue_date"] ?? doc.issueDate ?? ""),
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

    return input;
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
  const parts = [
    addr["line"],
    addr["urbanization"],
    addr["district"],
    addr["province"],
    addr["department"],
    addr["country_code"],
  ].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length ? parts.join(", ") : undefined;
}

function nonzeroMoney(value: unknown): string | undefined {
  return Number(value) > 0 ? moneyStr(value) : undefined;
}

function unitMoneyStr(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? formatUnit(number) : String(value);
}
