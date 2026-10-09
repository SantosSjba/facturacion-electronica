import type { PdfRenderInput } from "../ports/pdf-renderer.port";

const TYPE_LABEL: Record<string, string> = {
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
  const linesHtml = input.lines
    .map(
      (l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(l.description)}${l.productCode ? `<br>Código: ${esc(l.productCode)}` : ""}${l.sunatProductCode ? `<br>SUNAT: ${esc(l.sunatProductCode)}` : ""}${(l.details ?? []).map((detail) => `<br>${esc(detail)}`).join("")}${l.isc ? `<br>ISC: ${esc(l.isc)}` : ""}${l.icbper ? `<br>ICBPER: ${esc(l.icbper)}` : ""}</td>
        <td>${esc(l.quantity)} ${esc(l.unit)}</td>
        <td>${esc(l.unitPrice)}</td>
        <td>${esc(l.igv)}</td>
        <td>${esc(l.amount)}</td>
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
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .issuer-logo { display: block; max-width: 180px; max-height: 90px; object-fit: contain; margin-bottom: 10px; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
    .box { border: 1px solid #333; padding: 8px 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
    th { background: #f0f0f0; }
    .totals { margin-top: 12px; text-align: right; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .qr { font-size: 9px; word-break: break-all; max-width: 280px; border: 1px solid #ccc; padding: 8px; }
    .legend { margin-top: 16px; font-size: 10px; color: #444; }
  </style>
</head>
<body>
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
      <div>Moneda: ${esc(input.currency)}</div>
    </div>
  </div>
  <p><strong>Adquirente:</strong> ${esc(input.customer.identityType)} ${esc(input.customer.identityNumber)} — ${esc(input.customer.name)}</p>
  ${input.customer.address ? `<p>Dirección: ${esc(input.customer.address)}</p>` : ""}
  ${input.customer.email ? `<p>Email: ${esc(input.customer.email)}</p>` : ""}
  ${input.purchaseOrder ? `<p>Orden de compra: ${esc(input.purchaseOrder)}</p>` : ""}
  ${noteBlock}
  <table>
    <thead>
      <tr><th>#</th><th>Descripción</th><th>Cant.</th><th>P.U.</th><th>IGV / IVAP</th><th>Importe</th></tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>
  <div class="totals">
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
    <div><strong>Total: ${esc(input.totals.total)}</strong></div>
  </div>
  ${(input.commercialSections ?? []).map((section) => `<section><h2>${esc(section.title)}</h2>${section.entries.map((entry) => `<div><strong>${esc(entry.label)}:</strong> ${esc(entry.value)}</div>`).join("")}</section>`).join("")}
  <div class="footer">
    <div>
      <div><strong>Valor resumen (DigestValue):</strong></div>
      <div>${esc(input.digestValue)}</div>
    </div>
    <div class="qr">
      <div><strong>QR</strong></div>
      <div>${esc(input.qrPayload)}</div>
    </div>
  </div>
  <p class="legend">Representación impresa del comprobante de pago electrónico.</p>
  ${(input.legends ?? []).map((legend) => `<p class="legend">${esc(legend.code)}: ${esc(legend.text)}</p>`).join("")}
</body>
</html>`;
}
