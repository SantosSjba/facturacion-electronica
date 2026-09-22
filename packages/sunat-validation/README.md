# `@factosys/sunat-validation`

XSD + Excel P0 validation gate (S1-GATE / S2-VAL). Nightly XSL is warn-only.

## Unpack

```bash
pnpm sunat:unpack-schemas   # XSD → .cache/xsd-ubl/
pnpm sunat:unpack-xsl       # XSL + SFS commons → .cache/xsl-ubl-2.1/
```

Invoice XSD root: `Archivos XSD/2.1/maindoc/UBL-Invoice-2.1.xsd`  
Factura XSL (vendor): `validaciones/ValidaExprRegFactura-2.0.1.xsl`  
Runtime XSL (prepared): `runtime/ValidaExprRegFactura-2.0.1.xsl` (+ OASIS catalog for `local:///commons/`)

Commons come from `docs/sunat-oficial/04-esquemas-validacion/sfs-vali-commons.zip` (subset of SUNAT SFS `VALI/commons`).

## Validate

```bash
pnpm validate:xml --type=01 --stages=xsd,excel packages/sunat-ubl/testdata/golden/01-invoice-gravada.unsigned.xml
pnpm validate:xsl --type=01 packages/sunat-ubl/testdata/golden/01-invoice-gravada.unsigned.xml
```

- **PR CI:** XSD + Excel P0 → **blocking**
- **Nightly:** XSL via `xsltproc` (XSLT 1.0 + EXSLT) → `continue-on-error` (warn). Excel wins if XSL diverges.
- **XSL runner:** DataPower `dp:variable(nombreArchivoEnviado)` is shimmed to `--stringparam`; `local:///commons/` resolved via XML catalog + vendored SFS commons. Windows bootstraps pinned MSYS2 mingw64 `xsltproc` into `.cache/xsltproc-win/` when not on PATH.

## Port

```ts
import {
  CompositeSunatValidationAdapter,
  SUNAT_VALIDATION_PORT,
  type SunatValidationPort,
} from "@factosys/sunat-validation";
```

Stages: `xsd` | `excel`. Excel P0 rules (typed): RUC, serie-número, moneda (cat 02), TaxScheme, totales. OBS→ERROR codes in `assets/obs-to-error-codes.json`.
