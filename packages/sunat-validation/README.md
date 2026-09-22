# `@factosys/sunat-validation`

XSD validation gate for SUNAT UBL CPE (S1-GATE).

## Unpack schemas

Official zip (vendored + checksum-pinned):

- `docs/sunat-oficial/04-esquemas-validacion/xsd-ubl.zip`
- `docs/sunat-oficial/04-esquemas-validacion/xsd-ubl.zip.sha256`

```bash
pnpm sunat:unpack-schemas
```

Unpacks to `packages/sunat-validation/.cache/xsd-ubl/` (gitignored). Idempotent when the cache marker matches the pinned SHA256.

**Invoice root XSD:** `Archivos XSD/2.1/maindoc/UBL-Invoice-2.1.xsd`

## Validate

```bash
pnpm validate:xml --type=01 packages/sunat-ubl/testdata/golden/01-invoice-gravada.unsigned.xml
```

Uses `XmllintXsdValidationAdapter` (`xmllint-wasm` / libxml2) behind `SunatValidationPort` (stage `xsd`, documentType `01` only in S1).

## Port

```ts
import {
  SUNAT_VALIDATION_PORT,
  XmllintXsdValidationAdapter,
  type SunatValidationPort,
} from "@factosys/sunat-validation";
```
