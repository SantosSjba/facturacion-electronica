import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ADR-004: HMAC-SHA256 over `{timestamp}.{rawBody}` → `v1=<hex>`.
 */
export function signWebhookPayload(
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  const payload = `${timestamp}.${rawBody}`;
  const hex = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `v1=${hex}`;
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  rawBody: string,
  header: string,
): boolean {
  const expected = signWebhookPayload(secret, timestamp, rawBody);
  const parts = header.split(",").map((p) => p.trim());
  for (const part of parts) {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(part);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      // continue
    }
  }
  return false;
}
