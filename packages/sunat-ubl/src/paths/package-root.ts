import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Resolve package root by locating `assets/fixtures/01-invoice-gravada.json`. */
export function packageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "assets/fixtures/01-invoice-gravada.json");
    try {
      readFileSync(candidate, "utf8");
      return dir;
    } catch {
      dir = join(dir, "..");
    }
  }
  return process.cwd();
}

export function readAsset(relativePath: string): string {
  return readFileSync(join(packageRoot(), relativePath), "utf8");
}

export function readAssetJson<T>(relativePath: string): T {
  return JSON.parse(readAsset(relativePath)) as T;
}
