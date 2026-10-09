import type { PdfRenderInput } from "../ports/pdf-renderer.port";

const TYPE_LABEL: Record<string, string> = {
  "20": "COMPROBANTE DE RETENCIÓN ELECTRÓNICO",
  "40": "COMPROBANTE DE PERCEPCIÓN ELECTRÓNICO",
  RR: "RESUMEN DE REVERSIONES — DOCUMENTO INFORMATIVO",
  "09": "GUÍA DE REMISIÓN ELECTRÓNICA — REMITENTE",
  "31": "GUÍA DE REMISIÓN ELECTRÓNICA — TRANSPORTISTA",
  RC: "RESUMEN DIARIO — DOCUMENTO INFORMATIVO",
  RA: "COMUNICACIÓN DE BAJA — DOCUMENTO INFORMATIVO",
  "01": "FACTURA ELECTRÓNICA",
  "03": "BOLETA DE VENTA ELECTRÓNICA",
  "07": "NOTA DE CRÉDITO ELECTRÓNICA",
  "08": "NOTA DE DÉBITO ELECTRÓNICA",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildRiHtml(input: PdfRenderInput): string {
  const tax = input.taxAgent;
  const taxLabel = input.documentType === "20" ? "Retención" : "Percepción";
  const gre = input.documentType === "09" || input.documentType === "31";
  const ticket = input.format === "TICKET80" || input.format === "TICKET58";
  const linesHtml = input.lines
    .map(
      (l, i) => `
      <tr>
        <td class="index">${i + 1}</td>
        <td>${esc(l.description)}${ticket && !input.informational && !gre && !tax ? `<br>P.U.: ${esc(l.unitPrice)} · IGV / IVAP: ${esc(l.igv)}` : ""}${l.productCode ? `<br>Código: ${esc(l.productCode)}` : ""}${l.sunatProductCode ? `<br>SUNAT: ${esc(l.sunatProductCode)}` : ""}${(l.details ?? []).map((detail) => `<br>${esc(detail)}`).join("")}${l.isc ? `<br>ISC: ${esc(l.isc)}` : ""}${l.icbper ? `<br>ICBPER: ${esc(l.icbper)}` : ""}</td>
        ${
          !input.informational
            ? `<td>${esc(l.quantity)} ${esc(l.unit)}</td>
        ${gre ? "" : `<td class="price">${esc(l.unitPrice)}</td><td class="tax">${esc(l.igv)}</td><td class="amount">${esc(l.amount)}</td>`}`
            : ""
        }
      </tr>`,
    )
    .join("");

  const noteBlock =
    input.documentType === "07" || input.documentType === "08"
      ? `<p><strong>Doc. afectado:</strong> ${esc(input.affectedSerieNumber ?? "")}
         ${input.noteReason ? ` — ${esc(input.noteReason)}` : ""}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(TYPE_LABEL[input.documentType] ?? "CPE")} ${esc(input.serieNumber)}</title>
  <style>
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #111; margin: 0; overflow-wrap: anywhere; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .issuer-logo { display: block; max-width: 180px; max-height: 90px; object-fit: contain; margin-bottom: 10px; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
    .box { border: 1px solid #333; padding: 8px 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    h2 { font-size: 12px; break-after: avoid; }
    .totals, .footer, .closing { break-inside: avoid; }
    .watermark { position: fixed; top: 35%; left: 0; width: 100%; text-align: center; color: rgba(120,120,120,.22); font-size: 36px; transform: rotate(-30deg); z-index: 0; pointer-events: none; }
    .preview-banner { border: 2px solid #777; padding: 6px; font-weight: bold; margin-bottom: 10px; }
    .qr-image { display: block; image-rendering: pixelated; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
    .index { white-space: nowrap; overflow-wrap: normal; }
    td.price, td.tax, td.amount { white-space: nowrap; text-align: right; }
    th { overflow-wrap: normal; background: #f0f0f0; }
    .totals { margin-top: 12px; text-align: right; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .qr { font-size: 9px; word-break: break-all; max-width: 280px; border: 1px solid #ccc; padding: 8px; }
    .legend { margin-top: 16px; font-size: 10px; color: #444; }
    ${ticket ? `body { font-size: 10px; } h1 { font-size: 12px; } .header, .footer { display: block; } .header .box { margin-top: 8px; } th, td { padding: 3px 2px; } .index, .price, .tax { display: none; } .issuer-logo { max-width: 42mm; max-height: 20mm; } .qr { border: none; padding: 0; max-width: 100%; } .footer > div { margin-top: 8px; } .watermark { font-size: 20px; }` : ""}
  </style>
</head>
<body>
  ${input.preview ? `<div class="watermark">VISTA PREVIA</div><div class="preview-banner">VISTA PREVIA — SIN VALIDEZ TRIBUTARIA. Numeración referencial; no emitido ni enviado a SUNAT.</div>` : ""}
  <div class="header">
    <div>
      ${input.issuer.logoDataUrl && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(input.issuer.logoDataUrl) ? `<img class="issuer-logo" src="${esc(input.issuer.logoDataUrl)}" alt="Logo de ${esc(input.issuer.legalName)}" />` : ""}
      <h1>${esc(input.issuer.legalName)}</h1>
      <div>RUC ${esc(input.issuer.ruc)}</div>
      ${input.issuer.address ? `<div>${esc(input.issuer.address)}</div>` : ""}
    </div>
    <div class="box">
      <div><strong>${esc(TYPE_LABEL[input.documentType] ?? input.documentType)}</strong></div>
      <div>${esc(input.serieNumber)}</div>
      <div>Fecha: ${esc(input.issueDate)}</div>
      ${input.issueTime ? `<div>Hora: ${esc(input.issueTime)}</div>` : ""}
      ${input.dueDate ? `<div>Vencimiento: ${esc(input.dueDate)}</div>` : ""}
      ${gre ? "" : `<div>Moneda: ${esc(input.currency)}</div>`}
    </div>
  </div>
  ${
    !input.informational
      ? `<p><strong>${gre ? "Destinatario" : input.documentType === "20" ? "Proveedor" : "Adquirente"}:</strong> ${esc(input.customer.identityType)} ${esc(input.customer.identityNumber)} — ${esc(input.customer.name)}</p>
  ${input.customer.address ? `<p>Dirección: ${esc(input.customer.address)}</p>` : ""}
  `
      : ""
  }
  ${input.customer.email ? `<p>Email: ${esc(input.customer.email)}</p>` : ""}
  ${input.purchaseOrder ? `<p>Orden de compra: ${esc(input.purchaseOrder)}</p>` : ""}
  ${noteBlock}
  <table>
    <thead>
      ${gre ? `<tr><th class="index">#</th><th>Bienes a trasladar</th><th>Cantidad / unidad</th></tr>` : input.informational ? `<tr><th>#</th><th>Comprobante / operación y motivo</th></tr>` : `<tr><th class="index">#</th><th>Descripción</th><th>${tax ? "Pago Nº" : "Cant."}</th><th class="price">${tax ? "Base origen" : "P.U."}</th><th class="tax">${tax ? taxLabel + " PEN" : "IGV / IVAP"}</th><th class="amount">${tax ? "Pago / cobro PEN" : "Importe"}</th></tr>`}
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>
  ${
    !input.informational && !gre
      ? `<div class="totals">
    ${input.totals.gravado ? `<div>Gravado: ${esc(input.totals.gravado)}</div>` : ""}
    ${input.totals.igv ? `<div>IGV: ${esc(input.totals.igv)}</div>` : ""}
    ${input.totals.exempt ? `<div>Exonerado: ${esc(input.totals.exempt)}</div>` : ""}
    ${input.totals.unaffected ? `<div>Inafecto: ${esc(input.totals.unaffected)}</div>` : ""}
    ${input.totals.export ? `<div>Exportación: ${esc(input.totals.export)}</div>` : ""}
    ${input.totals.free ? `<div>Gratuito (referencial): ${esc(input.totals.free)}</div>` : ""}
    ${input.totals.freeTax ? `<div>Impuesto gratuito (no cobrado): ${esc(input.totals.freeTax)}</div>` : ""}
    ${input.totals.ivap ? `<div>IVAP: ${esc(input.totals.ivap)}</div>` : ""}
    ${input.totals.isc ? `<div>ISC: ${esc(input.totals.isc)}</div>` : ""}
    ${input.totals.icbper ? `<div>ICBPER: ${esc(input.totals.icbper)}</div>` : ""}
    ${input.totals.discounts ? `<div>Descuentos sin efecto tributario: ${esc(input.totals.discounts)}</div>` : ""}
    ${input.totals.charges ? `<div>Cargos sin efecto tributario: ${esc(input.totals.charges)}</div>` : ""}
    ${input.totals.prepaid ? `<div>Importe antes de anticipos: ${esc(input.totals.gross ?? "")}</div><div>Anticipos aplicados: ${esc(input.totals.prepaid)}</div>` : ""}
    <div><strong>${tax ? "Total " + taxLabel.toLowerCase() + " PEN" : "Total"}: ${esc(input.totals.total)}</strong></div>
  </div>
  `
      : ""
  }
  ${(input.commercialSections ?? []).map((section) => `<section><h2>${esc(section.title)}</h2>${section.entries.map((entry) => `<div><strong>${esc(entry.label)}:</strong> ${esc(entry.value)}</div>`).join("")}</section>`).join("")}
  ${input.observations ? `<p><strong>Observaciones:</strong> ${esc(input.observations)}</p>` : ""}
  <div class="closing">
  ${
    !input.preview && !input.informational
      ? `<div class="footer">
    <div>
      ${gre ? `<div><strong>Consulta SUNAT de la guía:</strong></div><div>${esc(input.qrPayload)}</div>` : `<div><strong>Valor resumen (DigestValue):</strong></div><div>${esc(input.digestValue)}</div>`}
    </div>
    <div class="qr">
      <div><strong>QR</strong></div>
      ${input.qrDataUrl && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(input.qrDataUrl) ? `<img class="qr-image" alt="QR del comprobante" width="${Math.round(((input.qrSizeMm ?? 35) * 96) / 25.4)}" style="width:${input.qrSizeMm ?? 35}mm;height:${input.qrSizeMm ?? 35}mm" src="${esc(input.qrDataUrl)}" />` : `<div>${esc(input.qrPayload)}</div>`}
    </div>
  </div>
  `
      : ""
  }
  <p class="legend">${gre ? "Representación impresa de la guía de remisión electrónica. QR proporcionado por SUNAT en el CDR aceptado." : input.informational ? "Documento informativo de resumen/baja. No es un comprobante de pago; consultar el estado vigente y el CDR mediante la API." : `${input.preview ? "Vista previa" : "Representación impresa"} del comprobante de pago electrónico.`}</p>
  ${(input.legends ?? []).map((legend) => `<p class="legend">${esc(legend.code)}: ${esc(legend.text)}</p>`).join("")}
  </div>
</body>
</html>`;
}
