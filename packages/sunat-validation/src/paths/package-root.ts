import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Resolve `packages/sunat-validation` root (src or dist). */
export function resolvePackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const pkgJson = join(dir, "package.json");
    if (existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as {
          name?: string;
        };
        if (pkg.name === "@factosys/sunat-validation") {
          return dir;
        }
      } catch {
        /* continue walking */
      }
    }
    dir = join(dir, "..");
  }
  return process.cwd();
}
