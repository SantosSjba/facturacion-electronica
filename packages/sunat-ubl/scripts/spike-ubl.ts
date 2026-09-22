/**
 * Spike B runner — hydrate fixture → unsigned UBL → sign (B→A) → tmp/spikes/ubl/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  XmlCryptoSignAdapter,
  generateTestPfx,
  loadPfx,
  verifySignedXml,
} from "@factosys/sunat-sign";

import {
  XmlInvoiceBuilder,
  hydrateGravadaFixture,
} from "../src/index";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const outDir = join(repoRoot, "tmp/spikes/ubl");

async function main(): Promise<void> {
  const canonical = hydrateGravadaFixture();
  const builder = new XmlInvoiceBuilder();
  const { xml, fileStem } = builder.build(canonical);

  const password = process.env.SPIKE_CERT_PASSWORD ?? "spike-ephemeral";
  let pfx: Buffer;
  let certSource: string;

  if (process.env.SPIKE_CERT_PATH) {
    const { readFileSync } = await import("node:fs");
    pfx = readFileSync(resolve(process.env.SPIKE_CERT_PATH));
    certSource = "SPIKE_CERT_PATH";
  } else {
    pfx = generateTestPfx(password).pfx;
    certSource = "ephemeral-self-signed";
    console.log(
      "[spike:ubl] No SPIKE_CERT_PATH — using ephemeral self-signed PFX (dev only).",
    );
  }

  const loaded = loadPfx(pfx, password);
  const signed = await new XmlCryptoSignAdapter().sign({
    xml,
    certificate: pfx,
    password,
  });
  const ok = verifySignedXml(signed.signedXml, loaded.certificatePem);
  if (!ok) {
    console.error("[spike:ubl] In-process verify FAILED");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "unsigned.xml"), xml.endsWith("\n") ? xml : `${xml}\n`);
  writeFileSync(join(outDir, "signed.xml"), signed.signedXml);
  writeFileSync(
    join(outDir, "meta.json"),
    `${JSON.stringify(
      {
        fileStem,
        documentId: `${canonical.serie}-${String(canonical.number).padStart(8, "0")}`,
        payableAmount: canonical.totals.payable_amount,
        subject: loaded.subject,
        certSource,
        digestValue: signed.digestValue,
        verifyInProcess: true,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`[spike:ubl] fileStem=${fileStem}`);
  console.log(`[spike:ubl] Wrote ${join(outDir, "unsigned.xml")}`);
  console.log(`[spike:ubl] Wrote ${join(outDir, "signed.xml")}`);
  console.log("[spike:ubl] Pipeline B→A Verify OK");
}

main().catch((err: unknown) => {
  console.error("[spike:ubl]", err instanceof Error ? err.message : err);
  process.exit(1);
});
