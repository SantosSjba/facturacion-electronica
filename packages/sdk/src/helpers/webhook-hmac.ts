import { createHmac, timingSafeEqual } from "node:crypto";

/** ADR-004: HMAC-SHA256 over `{timestamp}.{rawBody}` → `v1=<hex>`. */
export function verifyWebhookSignature(
  rawBody: string,
  headers: {
    "x-factosys-timestamp"?: string;
    "x-factosys-signature"?: string;
    timestamp?: string;
    signature?: string;
  },
  secret: string,
  toleranceSec = 300,
): boolean {
  const tsRaw =
    headers["x-factosys-timestamp"] ?? headers.timestamp ?? "";
  const sigHeader =
    headers["x-factosys-signature"] ?? headers.signature ?? "";
  const timestamp = Number(tsRaw);
  if (!Number.isFinite(timestamp) || !sigHeader) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;

  const expected =
    "v1=" +
    createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");

  for (const part of sigHeader.split(",").map((p) => p.trim())) {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(part);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      /* continue */
    }
  }
  return false;
}
