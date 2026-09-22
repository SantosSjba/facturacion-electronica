import { readAssetJson } from "../paths/package-root";
import { ublValidationError } from "../errors";

export interface TaxPair {
  tax_affectation: string;
  tax_scheme_id: string;
  tax_name: string;
  igv_percent_typical: number | null;
  label?: string;
  secondary_scheme?: string;
}

interface MatrixFile {
  pairs: TaxPair[];
}

let cached: TaxPair[] | undefined;

export function loadTaxMatrix(): TaxPair[] {
  if (!cached) {
    const file = readAssetJson<MatrixFile>("assets/catalogs/matrix-07-x-05-igv.json");
    cached = file.pairs.filter((p) => !p.secondary_scheme && p.tax_scheme_id);
  }
  return cached;
}

/**
 * Resolve Cat.07 × Cat.05 pair. Rejects unlisted combinations.
 */
export function resolveTaxPair(
  taxAffectation: string,
  taxSchemeId?: string,
): TaxPair {
  const pairs = loadTaxMatrix();
  const match = pairs.find((p) => {
    if (p.tax_affectation !== taxAffectation) return false;
    if (taxSchemeId && p.tax_scheme_id !== taxSchemeId) return false;
    return true;
  });

  if (!match || !match.tax_scheme_id) {
    throw ublValidationError(
      `Unsupported tax pair affectation=${taxAffectation} scheme=${taxSchemeId ?? "(auto)"}`,
      {
        details: [
          {
            path: "lines.tax_affectation",
            issue: "Pair not listed in matrix-07-x-05-igv",
          },
        ],
      },
    );
  }

  return match;
}
