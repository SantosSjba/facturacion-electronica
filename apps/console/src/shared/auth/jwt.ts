export interface AccessTokenClaims {
  sub: string;
  org: string;
  email: string;
  perms: string[];
  roles: string[];
  typ?: string;
  exp?: number;
  iat?: number;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

/** Decode JWT payload without verifying signature (API already issued it). */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    const json = base64UrlDecode(payloadPart);
    const payload = JSON.parse(json) as AccessTokenClaims;
    if (!payload.sub || !payload.email || !Array.isArray(payload.perms)) {
      return null;
    }
    return {
      ...payload,
      perms: payload.perms ?? [],
      roles: payload.roles ?? [],
    };
  } catch {
    return null;
  }
}

export function isTokenExpired(claims: AccessTokenClaims, skewSec = 30): boolean {
  if (!claims.exp) return false;
  return Date.now() / 1000 >= claims.exp - skewSec;
}
