import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { AppError } from "@factosys/shared";

/**
 * ADR-004: HTTPS-only + block private / link-local / metadata IPs.
 */
export async function assertSafeWebhookUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw AppError.validation("Invalid webhook URL", [
      { path: "url", issue: "invalid" },
    ]);
  }
  if (url.protocol !== "https:") {
    const allowHttp =
      process.env["NODE_ENV"] === "test" ||
      process.env["WEBHOOK_ALLOW_LOCALHOST"] === "1";
    if (!(allowHttp && url.protocol === "http:")) {
      throw AppError.validation("Webhook URL must use https", [
        { path: "url", issue: "https_required" },
      ]);
    }
  }
  if (url.username || url.password) {
    throw AppError.validation("Webhook URL must not include credentials", [
      { path: "url", issue: "credentials_forbidden" },
    ]);
  }

  const host = url.hostname;
  const allowLocal =
    process.env["NODE_ENV"] === "test" ||
    process.env["WEBHOOK_ALLOW_LOCALHOST"] === "1";

  if (
    !allowLocal &&
    (host === "localhost" || host.endsWith(".localhost"))
  ) {
    throw AppError.validation("Webhook URL host is not allowed", [
      { path: "url", issue: "ssrf_blocked" },
    ]);
  }

  const ips: string[] = [];
  if (isIP(host)) {
    ips.push(host);
  } else if (allowLocal && (host === "localhost" || host.endsWith(".localhost"))) {
    // skip DNS for local test receivers
  } else {
    try {
      const records = await lookup(host, { all: true, verbatim: true });
      for (const r of records) {
        ips.push(r.address);
      }
    } catch {
      throw AppError.validation("Webhook URL host could not be resolved", [
        { path: "url", issue: "dns_failed" },
      ]);
    }
  }

  for (const ip of ips) {
    if (!allowLocal && isPrivateOrBlockedIp(ip)) {
      throw AppError.validation("Webhook URL resolves to a blocked address", [
        { path: "url", issue: "ssrf_blocked" },
      ]);
    }
  }

  return url;
}

function isPrivateOrBlockedIp(ip: string): boolean {
  const v4 = ip.includes(".") && !ip.includes(":");
  if (v4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  return false;
}
