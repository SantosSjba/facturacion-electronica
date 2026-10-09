import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { PlaywrightPdfRenderer } from "../src/index";
import { greScenario } from "../../sunat-ubl/test-fixtures/gre-scenarios";
import { TEST_GRE_QR } from "../../sunat-gre/test-fixtures/cdr";
import { grePdfInput } from "../../../apps/api/src/infrastructure/pdf/gre-pdf";

async function main() {
  const dir = path.resolve("../../tmp/pdfs/phase3");
  fs.mkdirSync(dir, { recursive: true });
  const poppler = process.env.PDFTOPPM_PATH;
  const python = process.env.PDFTEXT_PYTHON_PATH;
  assert(poppler && python, "Set PDFTOPPM_PATH and PDFTEXT_PYTHON_PATH");
  const run = (exe: string, args: string[]) =>
    execFileSync(exe, args, { windowsHide: true, encoding: "utf8" });
  const renderer = new PlaywrightPdfRenderer();
  for (const kind of ["public", "carrier"] as const) {
    const c = greScenario(kind);
    const firstLine = c.lines[0];
    assert(firstLine);
    c.lines = Array.from({ length: 60 }, (_, i) => ({
      ...firstLine,
      id: i + 1,
      description:
        "BIEN " +
        String(i + 1).padStart(3, "0") +
        " - descripción de prueba para impresión de guías.",
    }));
    for (const format of ["A4", "A5", "TICKET80", "TICKET58"] as const) {
      const input = grePdfInput({
        documentType: c.document_type,
        status: "accepted",
        payload: {
          _canonical: c,
          _print: { format, template_version: "ri-v2" },
          _gre: { qr_source: "sunat_cdr", qr_url: TEST_GRE_QR },
        },
      } as Parameters<typeof grePdfInput>[0]);
      const name = kind + "-" + format,
        pdf = path.join(dir, name + ".pdf");
      fs.writeFileSync(pdf, await renderer.render(input));
      const text = run(python, [
        "-c",
        "import sys; from pypdf import PdfReader; sys.stdout.reconfigure(encoding='utf8'); print('\\n'.join(p.extract_text() or '' for p in PdfReader(sys.argv[1]).pages));print('PAGE_COUNT='+str(len(PdfReader(sys.argv[1]).pages)))",
        pdf,
      ]);
      const count = Number(text.match(/PAGE_COUNT=(\d+)/)?.[1]);
      assert(count > 1);
      for (let i = 1; i <= 60; i++)
        assert(text.includes("BIEN " + String(i).padStart(3, "0")), "Missing item " + i);
      assert(!text.includes("DigestValue") && !text.includes("Moneda:") && !text.includes("IGV:"));
      assert(text.includes("GUÍA DE REMISIÓN"));
      const stem = path.join(dir, name + "-last");
      run(poppler, [
        "-f",
        String(count),
        "-l",
        String(count),
        "-r",
        "180",
        "-singlefile",
        "-png",
        pdf,
        stem,
      ]);
      const png = PNG.sync.read(fs.readFileSync(stem + ".png"));
      assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, TEST_GRE_QR);
      if (format === "A4")
        run(poppler, [
          "-f",
          "1",
          "-l",
          "1",
          "-r",
          "120",
          "-singlefile",
          "-png",
          pdf,
          path.join(dir, name + "-first"),
        ]);
      console.log(name + ": " + count + " pages, 60 items complete; printed GRE QR decoded");
    }
  }
  console.log("QA artifacts: " + dir);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
