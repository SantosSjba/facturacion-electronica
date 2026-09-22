/**
 * Spike C runner — hydrate → build → sign → zip → SendBill (fake|beta) → parse CDR.
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
} from "@factosys/sunat-ubl";

import {
  assertCdrAccepted,
  createBillServiceFromEnv,
  packInvoiceZip,
  parseCdrZip,
} from "../src/index";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const outDir = join(repoRoot, "tmp/spikes/sendbill");

async function main(): Promise<void> {
  const mode = (process.env.SUNAT_BILL_MODE ?? "fake").toLowerCase();
  const canonical = hydrateGravadaFixture();
  const { xml, fileStem } = new XmlInvoiceBuilder().build(canonical);

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
      "[spike:sendbill] No SPIKE_CERT_PATH — using ephemeral self-signed PFX (dev only).",
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
    console.error("[spike:sendbill] In-process verify FAILED");
    process.exit(1);
  }

  const packed = packInvoiceZip({
    ruc: canonical.supplier.identity_number,
    documentType: "01",
    serie: canonical.serie,
    number: canonical.number,
    xml: signed.signedXml,
  });

  const solUser =
    process.env.SUNAT_SOL_USER ??
    `${canonical.supplier.identity_number}MODDATOS`;
  const solPassword = process.env.SUNAT_SOL_PASSWORD ?? "fake-password";

  if (mode === "beta" && !process.env.SUNAT_SOL_PASSWORD) {
    console.error(
      "[spike:sendbill] SUNAT_BILL_MODE=beta requires SUNAT_SOL_USER + SUNAT_SOL_PASSWORD (beta live pendiente de RUC).",
    );
    process.exit(2);
  }

  const bill = createBillServiceFromEnv();
  const sendResult = await bill.sendBill({
    zipBytes: packed.zipBytes,
    fileName: packed.fileName,
    solUser,
    solPassword,
  });

  const cdr = parseCdrZip(sendResult.rawCdrZip);
  if (mode === "fake") {
    assertCdrAccepted(cdr);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "unsigned.xml"), xml.endsWith("\n") ? xml : `${xml}\n`);
  writeFileSync(join(outDir, "signed.xml"), signed.signedXml);
  writeFileSync(join(outDir, packed.fileName), packed.zipBytes);
  writeFileSync(join(outDir, `R-${packed.fileStem}.zip`), sendResult.rawCdrZip);
  writeFileSync(
    join(outDir, "meta.json"),
    `${JSON.stringify(
      {
        fileStem,
        zipFileName: packed.fileName,
        mode,
        certSource,
        digestValue: signed.digestValue,
        cdrStatus: cdr.status,
        sunatCode: cdr.sunatCode,
        sunatMessage: cdr.sunatMessage,
        note:
          mode === "fake"
            ? "FakeBillService — C real pendiente de credenciales beta"
            : "SoapBillServiceAdapter beta",
      },
      null,
      2,
    )}\n`,
  );

  console.log(`[spike:sendbill] mode=${mode}`);
  console.log(`[spike:sendbill] zip=${packed.fileName}`);
  console.log(
    `[spike:sendbill] CDR status=${cdr.status} code=${cdr.sunatCode}`,
  );
  console.log(`[spike:sendbill] Wrote ${outDir}`);
  console.log("[spike:sendbill] Pipeline B→A→zip→SendBill→CDR OK");
}

main().catch((err: unknown) => {
  console.error("[spike:sendbill]", err);
  process.exit(1);
});
