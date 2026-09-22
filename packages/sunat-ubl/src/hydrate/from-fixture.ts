import {
  parseFixtureRequest,
  type InvoiceCanonical,
  type InvoiceFixtureRequest,
} from "../types/invoice-canonical";
import { readAssetJson } from "../paths/package-root";
import {
  computeAutoTotals,
  toCanonical,
} from "../totals/auto-totals";

/** Spike supplier when fixture `company_id` is a placeholder. */
export const SPIKE_SUPPLIER = {
  identity_type: "6",
  identity_number: "20601234567",
  name: "FACTOSYS SPIKE SAC",
} as const;

export const DEFAULT_CORRELATIVE = 1;

interface FixtureFile {
  id: string;
  request: unknown;
}

export function loadGravadaFixtureRequest(): InvoiceFixtureRequest {
  const file = readAssetJson<FixtureFile>(
    "assets/fixtures/01-invoice-gravada.json",
  );
  return parseFixtureRequest(file.request);
}

/**
 * Hydrate fixture request → InvoiceCanonical (supplier stub + auto totals).
 */
export function hydrateFromFixtureRequest(
  request: InvoiceFixtureRequest,
  options?: {
    supplier?: InvoiceCanonical["supplier"];
    number?: number;
  },
): InvoiceCanonical {
  const number = options?.number ?? request.number ?? DEFAULT_CORRELATIVE;
  const supplier = options?.supplier ?? { ...SPIKE_SUPPLIER };
  const { lines, totals } = computeAutoTotals(request);
  return toCanonical({ request, supplier, number, lines, totals });
}

export function hydrateGravadaFixture(options?: {
  supplier?: InvoiceCanonical["supplier"];
  number?: number;
}): InvoiceCanonical {
  return hydrateFromFixtureRequest(loadGravadaFixtureRequest(), options);
}
