import { createHash } from "node:crypto";

/**
 * Stable SHA-256 of a JSON body for idempotency request_hash.
 * Keys are sorted recursively so key order does not affect the hash.
 */
export function hashRequestBody(body: unknown): string {
  const canonical = JSON.stringify(canonicalize(body));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}
