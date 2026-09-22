/**
 * @factosys/sunat-catalogs — versioned SUNAT catalog lookups (S2-VAL).
 */

export const PACKAGE_NAME = "@factosys/sunat-catalogs" as const;

export {
  CATALOG_PORT,
  type CatalogFile,
  type CatalogItem,
  type CatalogPort,
} from "./ports/catalog.port";

export { JsonCatalogAdapter } from "./adapters/json-catalog.adapter";
