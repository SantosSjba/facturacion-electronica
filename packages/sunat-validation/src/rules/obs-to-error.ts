import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { resolvePackageRoot } from "../paths/package-root";

export const EXCEL_RULESET_VERSION = "2026-08-26" as const;

interface ObsToErrorFile {
  obsCodes?: string[];
  errorCodes?: string[];
}

let cachedObsErrorCodes: Set<string> | null = null;

export function loadObsToErrorCodes(
  packageRoot = resolvePackageRoot(),
): Set<string> {
  if (cachedObsErrorCodes) return cachedObsErrorCodes;
  const path = join(packageRoot, "assets/obs-to-error-codes.json");
  const set = new Set<string>();
  if (!existsSync(path)) {
    cachedObsErrorCodes = set;
    return set;
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as ObsToErrorFile;
  for (const c of raw.obsCodes ?? []) set.add(String(c));
  for (const c of raw.errorCodes ?? []) set.add(String(c));
  cachedObsErrorCodes = set;
  return set;
}

/** True if the SUNAT code must be treated as ERROR (OBS→ERROR listado). */
export function isObsMigratedToError(sunatCode: string): boolean {
  return loadObsToErrorCodes().has(sunatCode);
}
