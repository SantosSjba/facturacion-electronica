/**
 * @factosys/sunat-catalogs — catalog lookups (stub).
 */

export const PACKAGE_NAME = "@factosys/sunat-catalogs" as const;

export interface CatalogPort {
  getItem(_catalogId: string, _code: string): Promise<unknown | null>;
}
