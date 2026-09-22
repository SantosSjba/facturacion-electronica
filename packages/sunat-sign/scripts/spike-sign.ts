/**
 * Spike A runner — sign minimal Invoice, verify in-process, write tmp/spikes/sign/.
 *
 * Env (optional):
 *   SPIKE_CERT_PATH       path to .pfx / .p12
 *   SPIKE_CERT_PASSWORD   PKCS#12 password
 *
 * If unset, generates an ephemeral self-signed PFX (never written to disk as .pfx).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  XmlCryptoSignAdapter,
  generateTestPfx,
  loadPfx,
  verifySignedXml,
} from "../src/index";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const outDir = join(repoRoot, "tmp/spikes/sign");
const fixturePath = join(packageRoot, "testdata/minimal-invoice.unsigned.xml");

async function main(): Promise<void> {
  const certPath = process.env.SPIKE_CERT_PATH;
  const password = process.env.SPIKE_CERT_PASSWORD ?? "spike-ephemeral";

  let pfx: Buffer;
  let certSource: string;

  if (certPath) {
    pfx = readFileSync(resolve(certPath));
    certSource = "SPIKE_CERT_PATH";
  } else {
    const generated = generateTestPfx(password);
    pfx = generated.pfx;
    certSource = "ephemeral-self-signed";
    console.log(
      "[spike:sign] No SPIKE_CERT_PATH — using ephemeral self-signed PFX (dev only).",
    );
  }

  const loaded = loadPfx(pfx, password);
  console.log(`[spike:sign] Certificate subject: ${loaded.subject}`);

  const xml = readFileSync(fixturePath, "utf8");
  const adapter = new XmlCryptoSignAdapter();
  const result = await adapter.sign({ xml, certificate: pfx, password });

  const ok = verifySignedXml(result.signedXml, loaded.certificatePem);
  if (!ok) {
    console.error("[spike:sign] In-process verify FAILED");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const signedPath = join(outDir, "signed.xml");
  const metaPath = join(outDir, "meta.json");

  writeFileSync(signedPath, result.signedXml, "utf8");
  writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        subject: loaded.subject,
        certSource,
        digestValue: result.digestValue,
        signatureValueLength: result.signatureValue?.length ?? 0,
        verifyInProcess: true,
        a4Note:
          "SFS/external validator deferred until beta cert; in-process verify is Spike A trusted equivalent (doc 24 §A.6).",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`[spike:sign] Wrote ${signedPath}`);
  console.log(`[spike:sign] Wrote ${metaPath}`);
  console.log("[spike:sign] Verify OK (A3 / A4 equivalent)");
}

main().catch((err: unknown) => {
  console.error("[spike:sign]", err instanceof Error ? err.message : err);
  process.exit(1);
});
