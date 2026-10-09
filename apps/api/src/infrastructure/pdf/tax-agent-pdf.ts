import {
  buildQrPayload,
  readSignedCpeQr,
  PDF_TEMPLATE_VERSION,
  type PdfRenderInput,
} from "@factosys/pdf-ri";
import type { TaxAgentCanonical } from "@factosys/sunat-ubl";
import type { DocumentsService } from "../documents/documents.service";

export function taxAgentPdfInput(
  doc: Awaited<ReturnType<DocumentsService["getById"]>>,
  xml: string,
  logoDataUrl?: string,
  preview = false,
): PdfRenderInput {
  const p = doc.payload as {
    _canonical: TaxAgentCanonical;
    _print?: { format: PdfRenderInput["format"]; template_version: string };
  };
  const c = p._canonical;
  const signed = preview ? undefined : readSignedCpeQr(xml);
  if (!preview && !signed) throw new Error("Tax-agent signed XML lacks QR data");
  const fiscal = signed ?? {
    serie: c.serie,
    number: String(c.number).padStart(8, "0"),
    issueDate: c.issue_date,
    digestValue: "",
  };
  const retention = c.document_type === "20",
    money = (n: number | undefined) => {
      if (n === undefined) throw new Error("Missing fiscal amount");
      return n.toFixed(2);
    };
  return {
    documentType: c.document_type,
    serieNumber: `${fiscal.serie}-${fiscal.number}`,
    issueDate: fiscal.issueDate,
    issueTime: c.issue_time,
    currency: "PEN",
    format: p._print?.format ?? "A4",
    templateVersion: p._print?.template_version ?? PDF_TEMPLATE_VERSION,
    issuer: {
      ruc: c.supplier.identity_number,
      legalName: c.supplier.name,
      address: c.supplier.address?.line,
      logoDataUrl,
    },
    customer: {
      identityType: c.customer.identity_type,
      identityNumber: c.customer.identity_number,
      name: c.customer.name,
      address: c.customer.address?.line,
    },
    lines: c.references.map((r) =>
      !r.payment
        ? {
            description: `07 ${r.serie_number}`,
            quantity: "",
            unit: "",
            unitPrice: "",
            igv: "",
            amount: "",
            details: [
              `Nota de crédito: ${r.currency} ${money(r.total_amount)} (${r.issue_date})`,
              `Disminuye ${r.adjusts_document?.document_type} ${r.adjusts_document?.serie_number}; no genera pago ni impuesto`,
            ],
          }
        : {
            description: `${r.document_type} ${r.serie_number}`,
            quantity: String(r.payment.number),
            unit: "",
            unitPrice: money(r.payment.amount),
            igv: money(r.tax_amount),
            amount: money(r.settlement_amount),
            details: [
              `Emisión: ${r.issue_date} · Total documento: ${r.currency} ${money(r.total_amount)}`,
              `${retention ? "Pago" : "Cobro"}: ${r.payment.date} · Base: ${r.currency} ${money(r.payment.amount)}`,
              ...(r.exchange_rate
                ? [
                    `Tipo de cambio ${r.exchange_rate.source_currency}/PEN: ${r.exchange_rate.rate} (${r.exchange_rate.date})`,
                  ]
                : []),
              `${retention ? "Retención" : "Percepción"}: PEN ${money(r.tax_amount)} · ${retention ? "Neto pagado" : "Total cobrado"}: PEN ${money(r.settlement_amount)}`,
            ],
          },
    ),
    totals: { total: money(c.totals.tax_amount) },
    taxAgent: true,
    commercialSections: [
      {
        title: "Régimen y totales en soles",
        entries: [
          { label: "Régimen", value: `${c.regime} — ${c.percent}%` },
          {
            label: retention ? "Total retenido" : "Total percibido",
            value: `PEN ${money(c.totals.tax_amount)}`,
          },
          {
            label: retention ? "Neto total pagado" : "Total cobrado incluida percepción",
            value: `PEN ${money(c.totals.settlement_amount)}`,
          },
        ],
      },
    ],
    digestValue: fiscal.digestValue,
    qrPayload: signed ? buildQrPayload(signed) : "",
    observations: c.observations,
  };
}
