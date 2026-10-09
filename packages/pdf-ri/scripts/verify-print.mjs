/* Standalone acceptance check. Build first; provide PDFTOPPM_PATH or Poppler on PATH. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { PlaywrightPdfRenderer, buildQrPayload } from "../dist/index.js";
const destination = fs.mkdtempSync(path.join(os.tmpdir(), "factosys-print-"));
const poppler = process.env.PDFTOPPM_PATH || "pdftoppm";
const tool = (name) =>
  process.env.PDFTOPPM_PATH ? path.join(path.dirname(poppler), name + path.extname(poppler)) : name;
const run = (exe, args) => execFileSync(exe, args, { windowsHide: true, encoding: "utf8" });
const readText = (pdf) =>
  process.env.PDFTEXT_PYTHON_PATH
    ? run(process.env.PDFTEXT_PYTHON_PATH, [
        "-c",
        "import sys; from pypdf import PdfReader; sys.stdout.reconfigure(encoding='utf-8'); print('\\n'.join(p.extract_text() or '' for p in PdfReader(sys.argv[1]).pages))",
        pdf,
      ])
    : run(tool("pdftotext"), ["-layout", pdf, "-"]);
const qrFields = {
  ruc: "20601234567",
  documentType: "01",
  serie: "F001",
  number: "00000012",
  igv: "1800.00",
  total: "11800.00",
  issueDate: "2026-10-08",
  customerIdentityType: "6",
  customerIdentityNumber: "20100070970",
  digestValue: "YjFkNWUyOGFhN2M2NWZmMWY3YjAwMGY3ZA==",
};
const input = {
  documentType: "01",
  serieNumber: "F001-00000012",
  issueDate: qrFields.issueDate,
  currency: "PEN",
  templateVersion: "ri-v2",
  issuer: {
    ruc: qrFields.ruc,
    legalName: "EMISOR DE PRUEBA SAC",
    address: "Av. Ejemplo 123 - Lima",
  },
  customer: {
    identityType: "6",
    identityNumber: qrFields.customerIdentityNumber,
    name: "CLIENTE SAC",
    address: "Calle Uno 234",
  },
  lines: Array.from({ length: 100 }, (_, i) => ({
    description: `PRODUCTO ${String(i + 1).padStart(3, "0")} - descripción detallada del servicio o artículo para verificar el salto de página.`,
    productCode: `SKU-${i + 1}`,
    quantity: "1",
    unit: "NIU",
    unitPrice: "118.00",
    igv: "18.00",
    amount: "118.00",
  })),
  totals: { gravado: "10000.00", igv: "1800.00", total: "11800.00" },
  observations: "Entregar en almacén.",
  digestValue: qrFields.digestValue,
  qrPayload: buildQrPayload(qrFields),
};
(async () => {
  const renderer = new PlaywrightPdfRenderer();
  for (const [format, width] of [
    ["A4", 595.28],
    ["A5", 419.53],
    ["TICKET80", 226.77],
    ["TICKET58", 164.41],
  ]) {
    const pdf = path.join(destination, format + ".pdf");
    fs.writeFileSync(pdf, await renderer.render({ ...input, format }));
    const info = run(tool("pdfinfo"), [pdf]);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    assert(pages > 1);
    const pageWidth = Number(info.match(/^Page size:\s+([\d.]+)/m)?.[1]);
    assert(Math.abs(pageWidth - width) < 1);
    const text = readText(pdf);
    for (let i = 1; i <= 100; i++)
      assert(
        text.includes(`PRODUCTO ${String(i).padStart(3, "0")}`),
        `${format}: missing line ${i}`,
      );
    const stem = path.join(destination, format + "-last");
    run(poppler, [
      "-f",
      String(pages),
      "-l",
      String(pages),
      "-r",
      "200",
      "-singlefile",
      "-png",
      pdf,
      stem,
    ]);
    const png = PNG.sync.read(fs.readFileSync(stem + ".png"));
    assert.equal(
      jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
      input.qrPayload,
    );
    console.log(
      `${format}: ${pages} pages, physical width verified, 100 lines present, printed QR decoded`,
    );
  }
  const short = {
    ...input,
    lines: input.lines.slice(0, 2),
    totals: { gravado: "200.00", igv: "36.00", total: "236.00" },
  };
  const preview = path.join(destination, "preview.pdf");
  fs.writeFileSync(preview, await renderer.render({ ...short, preview: true }));
  const previewText = readText(preview);
  assert(previewText.includes("VISTA PREVIA"));
  assert(!previewText.includes("DigestValue"));
  const note = path.join(destination, "note.pdf");
  fs.writeFileSync(
    note,
    await renderer.render({
      ...short,
      documentType: "07",
      serieNumber: "FC01-00000012",
      affectedSerieNumber: input.serieNumber,
      noteReason: "Descuento comercial",
      qrPayload: buildQrPayload({
        ...qrFields,
        documentType: "07",
        serie: "FC01",
        igv: "36.00",
        total: "236.00",
      }),
    }),
  );
  const noteText = readText(note);
  assert(noteText.includes("F001-00000012"));
  assert(noteText.includes("Descuento comercial"));
  console.log(`Preview and note verified. QA artifacts: ${destination}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
