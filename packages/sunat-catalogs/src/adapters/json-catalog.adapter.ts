import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  listAssetJsonFiles,
  resolveAssetsDir,
  resolvePackageRoot,
} from "../paths/package-root";
import type {
  CatalogFile,
  CatalogItem,
  CatalogPort,
} from "../ports/catalog.port";

interface Manifest {
  rulesetVersion: string;
  catalogs?: string[];
}

/**
 * Loads catalog JSON from `packages/sunat-catalogs/assets/`.
 */
export class JsonCatalogAdapter implements CatalogPort {
  private readonly version: string;
  private readonly byCatalog = new Map<string, Map<string, CatalogItem>>();

  constructor(assetsDir = resolveAssetsDir(resolvePackageRoot())) {
    const manifestPath = join(assetsDir, "manifest.json");
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as Manifest;
    this.version = manifest.rulesetVersion;

    for (const file of listAssetJsonFiles(assetsDir)) {
      const raw = JSON.parse(
        readFileSync(join(assetsDir, file), "utf8"),
      ) as CatalogFile;
      if (!raw.catalog || !Array.isArray(raw.items)) continue;
      const map = new Map<string, CatalogItem>();
      for (const item of raw.items) {
        if (item?.code != null) {
          map.set(String(item.code), item);
        }
      }
      this.byCatalog.set(String(raw.catalog), map);
    }
  }

  rulesetVersion(): string {
    return this.version;
  }

  listCatalogIds(): string[] {
    return [...this.byCatalog.keys()].sort();
  }

  async getItem(
    catalogId: string,
    code: string,
  ): Promise<CatalogItem | null> {
    return this.byCatalog.get(catalogId)?.get(code) ?? null;
  }

  async hasCode(catalogId: string, code: string): Promise<boolean> {
    return (await this.getItem(catalogId, code)) != null;
  }
}
