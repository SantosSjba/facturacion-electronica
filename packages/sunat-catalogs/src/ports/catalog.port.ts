/**
 * Nest / DI token for the active CatalogPort adapter.
 */
export const CATALOG_PORT: unique symbol = Symbol("CatalogPort");

export interface CatalogItem {
  code: string;
  description: string;
  [key: string]: unknown;
}

export interface CatalogFile {
  catalog: string;
  name: string;
  version: string;
  items: CatalogItem[];
}

/**
 * Versioned SUNAT catalog lookups (S2-VAL / FE-101).
 */
export interface CatalogPort {
  /** Ruleset / export version (e.g. 2026-08-26). */
  rulesetVersion(): string;

  listCatalogIds(): string[];

  getItem(catalogId: string, code: string): Promise<CatalogItem | null>;

  hasCode(catalogId: string, code: string): Promise<boolean>;
}
