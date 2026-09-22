import { FactosysClient } from "./client";
export { FactosysClient } from "./client";
export {
  FactosysError,
  ValidationError,
  SunatRejectedError,
  IdempotencyConflictError,
  mapError,
  isRetryable,
  type FactosysErrorBody,
} from "./errors";
export { verifyWebhookSignature } from "./helpers/webhook-hmac";
export type { FactosysClientOptions, RequestOptions } from "./types";

export const PACKAGE_NAME = "@factosys/sdk" as const;

/** Convenience: fetch platform ruleset without API key (public endpoint). */
export async function getRuleset(
  baseUrl: string,
): Promise<{
  ruleset_version: string;
  source: string;
  source_sha256: string;
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/meta/ruleset`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`getRuleset failed: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    ruleset_version: string;
    source: string;
    source_sha256: string;
  };
}

export { FactosysClient as default };
