/**
 * XSL smoke for Invoice 01 using libxslt/xsltproc (XSLT 1.0 + EXSLT).
 *
 * Requires: pnpm sunat:unpack-xsl (XSL zip + SFS commons + runtime prepare).
 *
 * Usage: pnpm validate:xsl --type=01 <path-to-xml>
 * Optional: --archivo=RUC-01-F001-00000001.xml  (SUNAT zip member name)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureXsltproc } from "./ensure-xsltproc.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const cacheDir = join(packageRoot, ".cache/xsl-ubl-2.1");
const runtimeXsl = join(cacheDir, "runtime/ValidaExprRegFactura-2.0.1.xsl");
const catalogXml = join(cacheDir, "runtime/catalog.xml");

function usage() {
  console.error(
    "Usage: pnpm validate:xsl --type=01 [--archivo=NAME.xml] <path-to-xml>",
  );
  process.exit(2);
}

function parseArgs(argv) {
  let type = "";
  let archivo = "";
  const positionals = [];
  for (const arg of argv) {
    if (arg.startsWith("--type=")) type = arg.slice("--type=".length);
    else if (arg.startsWith("--archivo="))
      archivo = arg.slice("--archivo=".length);
    else if (arg.startsWith("-")) usage();
    else positionals.push(arg);
  }
  const file = positionals[0];
  if (!type || !file) usage();
  return { type, file, archivo };
}

function textContent(xml, localName) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${localName}>`,
    "i",
  );
  const m = xml.match(re);
  return m?.[1]?.trim() ?? "";
}

/**
 * Build SUNAT nombreArchivoEnviado (includes .xml) from Invoice payload.
 * Shape: {RUC}-01-{F###}-{########}.xml
 */
function deriveNombreArchivo(xml, absPath) {
  const ruc =
    textContent(xml, "CompanyID") ||
    (() => {
      const m = xml.match(
        /AccountingSupplierParty[\s\S]*?<(?:[\w.-]+:)?ID\b[^>]*>(\d{11})</i,
      );
      return m?.[1] ?? "";
    })();
  const id = textContent(xml, "ID"); // F001-00000001 (first cbc:ID is usually serie-numero)
  const typeCode = textContent(xml, "InvoiceTypeCode") || "01";
  if (ruc.length === 11 && /^[F][A-Z0-9]{3}-\d{1,8}$/i.test(id)) {
    const [serie, numero] = id.split("-");
    const num = numero.padStart(8, "0");
    return `${ruc}-${typeCode}-${serie}-${num}.xml`;
  }
  // Fallback: basename only if already SUNAT-shaped
  const base = basename(absPath);
  if (/^\d{11}-\d{2}-[A-Z0-9]{4}-\d+\.xml$/i.test(base)) return base;
  throw new Error(
    `[validate:xsl] Cannot derive nombreArchivoEnviado from XML (RUC/ID). Pass --archivo=`,
  );
}

async function main() {
  const { type, file, archivo } = parseArgs(process.argv.slice(2));
  if (type !== "01") {
    console.error(`[validate:xsl] Unsupported --type=${type} (only 01)`);
    process.exit(2);
  }

  if (!existsSync(runtimeXsl) || !existsSync(catalogXml)) {
    console.error(
      `[validate:xsl] Runtime XSL missing. Run: pnpm sunat:unpack-xsl\n  expected: ${runtimeXsl}`,
    );
    process.exit(1);
  }

  const absXml = resolve(process.cwd(), file);
  if (!existsSync(absXml)) {
    console.error(`[validate:xsl] XML not found: ${absXml}`);
    process.exit(1);
  }

  const xmlText = readFileSync(absXml, "utf8");
  const nombreArchivo = archivo || deriveNombreArchivo(xmlText, absXml);

  const { bin, envPathPrefix } = await ensureXsltproc();
  const outDir = join(packageRoot, "../../tmp/xsl-smoke");
  mkdirSync(outDir, { recursive: true });
  const outXml = join(outDir, "factura-xsl-result.xml");
  const logPath = join(outDir, "xsltproc-log.txt");

  const env = { ...process.env };
  if (envPathPrefix) {
    env.PATH = `${envPathPrefix}${env.PATH ? `;${env.PATH}` : ""}`;
  }
  // libxml catalog resolution
  env.XML_CATALOG_FILES = catalogXml;
  // Prefer file URL form as well for some builds
  env.SGML_CATALOG_FILES = catalogXml;

  console.log(`[validate:xsl] xsltproc=${bin}`);
  console.log(`[validate:xsl] stylesheet=${runtimeXsl}`);
  console.log(`[validate:xsl] catalog=${catalogXml}`);
  console.log(`[validate:xsl] nombreArchivoEnviado=${nombreArchivo}`);
  console.log(`[validate:xsl] xml=${absXml}`);

  const args = [
    "--nonet",
    "--catalogs",
    "--stringparam",
    "nombreArchivoEnviado",
    nombreArchivo,
    "-o",
    outXml,
    runtimeXsl,
    absXml,
  ];

  const run = spawnSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env,
  });
  const combined = `${run.stdout || ""}\n${run.stderr || ""}`.trim();
  writeFileSync(
    logPath,
    `exit=${run.status}\narchivo=${nombreArchivo}\n\n${combined}\n`,
    "utf8",
  );

  if (run.status === 0) {
    console.log(`[validate:xsl] OK → ${outXml}`);
    if (combined) console.log(combined.slice(0, 2000));
    process.exit(0);
  }

  // xsltproc: non-zero often means rejectCall (business rule fail) — still a successful runner
  console.error(`[validate:xsl] FAIL (xsltproc exit ${run.status})`);
  if (combined) console.error(combined.slice(0, 6000));
  console.error(`[validate:xsl] log → ${logPath}`);
  console.error(
    `[validate:xsl] Note: nightly is warn-only; Excel P0 remains the PR gate.`,
  );
  process.exit(run.status || 1);
}

main().catch((err) => {
  console.error(`[validate:xsl] ${err?.stack || err}`);
  process.exit(1);
});
