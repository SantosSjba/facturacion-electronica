# @factosys/sunat-sign

XMLDSig signing for SUNAT CPE (Spike A / S1-SIGN). Isolated from UBL builders ([ADR-003](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/adr/003-separacion-ubl-sign.md)).

## Port

```ts
import {
  SIGN_XML_PORT,
  XmlCryptoSignAdapter,
  type SignXmlPort,
} from "@factosys/sunat-sign";

const signer: SignXmlPort = new XmlCryptoSignAdapter();
const { signedXml, digestValue } = await signer.sign({
  xml: unsignedUbl,
  certificate: pfxBuffer,
  password: process.env.SPIKE_CERT_PASSWORD!,
});
```

- **Adapter:** `XmlCryptoSignAdapter` — `xml-crypto` + `@xmldom/xmldom`
- **Algorithms:** Exclusive C14N, enveloped-signature, RSA-SHA256, SHA-256 digest
- **Insertion:** first `ext:ExtensionContent` (creates `UBLExtensions` if missing)
- **DI token:** `SIGN_XML_PORT` (`Symbol`) for Nest wiring later

## Certificate handling

| Concern | Behavior |
| --- | --- |
| Load | `loadPfx(buffer, password)` via `node-forge` PKCS#12 |
| Logs | Subject DN only — never password / PEM / key |
| Git | `*.pfx`, `*.p12`, `certs/`, `tmp/spikes/**` ignored |
| Tests / spike | Ephemeral self-signed PFX via `generateTestPfx` when no real cert |

Env for local spike:

- `SPIKE_CERT_PATH` — path to `.pfx` / `.p12` (optional)
- `SPIKE_CERT_PASSWORD` — PKCS#12 password

## Spike runner

```bash
pnpm spike:sign
# → tmp/spikes/sign/signed.xml + meta.json
# → in-process verify must be OK
```

## External validator (A4)

Spike A closes with **in-process verify** as the trusted equivalent (doc 24 §A.6).  
When a beta SOL certificate is available, validate the same `tmp/spikes/sign/signed.xml` with SUNAT SFS / official validator and attach notes to ADR-002. Do not commit real signed CPE or PFX.

## ADR

Library decision: [ADR-002](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/adr/002-libreria-firma-xmldsig.md).
