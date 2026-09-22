/**
 * Unpack docs/sunat-oficial/04-esquemas-validacion/xsd-ubl.zip into
 * packages/sunat-validation/.cache/xsd-ubl/ after verifying SHA256.
 *
 * Idempotent: skips unzip when cache marker matches expected hash.
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

import AdmZip from "adm-zip";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const zipPath = join(
  repoRoot,
  "docs/sunat-oficial/04-esquemas-validacion/xsd-ubl.zip",
);
const shaPath = join(
  repoRoot,
  "docs/sunat-oficial/04-esquemas-validacion/xsd-ubl.zip.sha256",
);
const cacheDir = join(repoRoot, "packages/sunat-validation/.cache/xsd-ubl");
const markerPath = join(cacheDir, ".sha256");

function expectedHash() {
  const raw = readFileSync(shaPath, "utf8").trim();
  const hash = raw.split(/\s+/)[0]?.toLowerCase();
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`Invalid SHA256 file: ${shaPath}`);
  }
  return hash;
}

function fileSha256(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function main() {
  if (!existsSync(zipPath)) {
    console.error(`[unpack-schemas] Missing zip: ${zipPath}`);
    process.exit(1);
  }
  if (!existsSync(shaPath)) {
    console.error(`[unpack-schemas] Missing checksum: ${shaPath}`);
    process.exit(1);
  }

  const expected = expectedHash();
  const actual = fileSha256(zipPath);
  if (actual !== expected) {
    console.error(
      `[unpack-schemas] SHA256 mismatch for xsd-ubl.zip\n  expected: ${expected}\n  actual:   ${actual}`,
    );
    process.exit(1);
  }

  if (existsSync(markerPath)) {
    const cached = readFileSync(markerPath, "utf8").trim().toLowerCase();
    if (cached === expected) {
      const invoiceXsd = join(
        cacheDir,
        "Archivos XSD/2.1/maindoc/UBL-Invoice-2.1.xsd",
      );
      if (existsSync(invoiceXsd)) {
        console.log(
          `[unpack-schemas] Cache hit (${expected.slice(0, 12)}…) → ${cacheDir}`,
        );
        return;
      }
    }
  }

  console.log(`[unpack-schemas] Unpacking ${zipPath}`);
  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(cacheDir, true);

  writeFileSync(markerPath, `${expected}\n`, "utf8");

  const invoiceXsd = join(
    cacheDir,
    "Archivos XSD/2.1/maindoc/UBL-Invoice-2.1.xsd",
  );
  if (!existsSync(invoiceXsd)) {
    console.error(
      `[unpack-schemas] Expected Invoice XSD missing after unpack:\n  ${invoiceXsd}`,
    );
    process.exit(1);
  }

  console.log(`[unpack-schemas] OK → ${cacheDir}`);
  console.log(
    `[unpack-schemas] Invoice root: Archivos XSD/2.1/maindoc/UBL-Invoice-2.1.xsd`,
  );
}

main();
