import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Resolve `packages/sunat-catalogs` root (src or dist). */
export function resolvePackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const pkgJson = join(dir, "package.json");
    if (existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as {
          name?: string;
        };
        if (pkg.name === "@factosys/sunat-catalogs") {
          return dir;
        }
      } catch {
        /* continue */
      }
    }
    dir = join(dir, "..");
  }
  return process.cwd();
}

export function resolveAssetsDir(packageRoot = resolvePackageRoot()): string {
  return join(packageRoot, "assets");
}

export function listAssetJsonFiles(assetsDir = resolveAssetsDir()): string[] {
  return readdirSync(assetsDir).filter(
    (f) => f.endsWith(".json") && f !== "manifest.json",
  );
}
