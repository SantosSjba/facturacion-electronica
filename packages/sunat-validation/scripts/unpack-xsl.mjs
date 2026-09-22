/**
 * Unpack official XSL zip + SFS VALI commons into
 * packages/sunat-validation/.cache/xsl-ubl-2.1/ then prepare a runnable tree.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

import AdmZip from "adm-zip";

import { prepareXslRuntime } from "./prepare-xsl-runtime.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const docsDir = join(repoRoot, "docs/sunat-oficial/04-esquemas-validacion");
const xslZip = join(docsDir, "xsl-ubl-2.1-2022-09-06.zip");
const xslSha = join(docsDir, "xsl-ubl-2.1-2022-09-06.zip.sha256");
const commonsZip = join(docsDir, "sfs-vali-commons.zip");
const commonsSha = join(docsDir, "sfs-vali-commons.zip.sha256");
const cacheDir = join(repoRoot, "packages/sunat-validation/.cache/xsl-ubl-2.1");
const markerPath = join(cacheDir, ".sha256");
const facturaXslRel = "validaciones/ValidaExprRegFactura-2.0.1.xsl";

function readSha(path) {
  const raw = readFileSync(path, "utf8").trim();
  const hash = raw.split(/\s+/)[0]?.toLowerCase();
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`Invalid SHA256 file: ${path}`);
  }
  return hash;
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify(zipPath, shaPath, label) {
  if (!existsSync(zipPath)) {
    console.error(`[unpack-xsl] Missing ${label} zip: ${zipPath}`);
    process.exit(1);
  }
  if (!existsSync(shaPath)) {
    console.error(`[unpack-xsl] Missing ${label} checksum: ${shaPath}`);
    process.exit(1);
  }
  const expected = readSha(shaPath);
  const actual = fileSha256(zipPath);
  if (actual !== expected) {
    console.error(
      `[unpack-xsl] ${label} SHA256 mismatch\n  expected: ${expected}\n  actual:   ${actual}`,
    );
    process.exit(1);
  }
  return expected;
}

function main() {
  const xslHash = verify(xslZip, xslSha, "xsl-ubl");
  const commonsHash = verify(commonsZip, commonsSha, "sfs-vali-commons");
  const combined = `${xslHash}:${commonsHash}`;

  const facturaXsl = join(cacheDir, facturaXslRel);
  const validateUtils = join(cacheDir, "commons/error/validate_utils.xsl");
  const runtimeXsl = join(cacheDir, "runtime/ValidaExprRegFactura-2.0.1.xsl");

  if (
    existsSync(markerPath) &&
    readFileSync(markerPath, "utf8").trim() === combined &&
    existsSync(facturaXsl) &&
    existsSync(validateUtils) &&
    existsSync(runtimeXsl)
  ) {
    console.log(
      `[unpack-xsl] Cache hit (${combined.slice(0, 24)}…) → ${cacheDir}`,
    );
    return;
  }

  console.log(`[unpack-xsl] Unpacking XSL + SFS commons`);
  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  new AdmZip(xslZip).extractAllTo(cacheDir, true);
  new AdmZip(commonsZip).extractAllTo(cacheDir, true);

  if (!existsSync(facturaXsl)) {
    console.error(`[unpack-xsl] Expected XSL missing:\n  ${facturaXsl}`);
    process.exit(1);
  }
  if (!existsSync(validateUtils)) {
    console.error(`[unpack-xsl] Expected commons missing:\n  ${validateUtils}`);
    process.exit(1);
  }

  prepareXslRuntime(cacheDir);
  writeFileSync(markerPath, `${combined}\n`, "utf8");

  console.log(`[unpack-xsl] OK → ${cacheDir}`);
  console.log(`[unpack-xsl] Factura root: ${facturaXslRel}`);
  console.log(
    `[unpack-xsl] Runtime: runtime/ValidaExprRegFactura-2.0.1.xsl`,
  );
  console.log(`[unpack-xsl] Catalog: ${pathToFileURL(join(cacheDir, "runtime/catalog.xml")).href}`);
}

main();
