# `@factosys/sunat-catalogs`

Versioned SUNAT catalog lookups (S2-VAL / FE-101).

## Assets

JSON under `assets/` (exported from CPE Excel `2026-08-26`). See `assets/manifest.json` for `rulesetVersion`.

## Usage

```ts
import {
  CATALOG_PORT,
  JsonCatalogAdapter,
  type CatalogPort,
} from "@factosys/sunat-catalogs";

const catalogs = new JsonCatalogAdapter();
await catalogs.hasCode("01", "01"); // Factura
await catalogs.getItem("02", "PEN");
```
