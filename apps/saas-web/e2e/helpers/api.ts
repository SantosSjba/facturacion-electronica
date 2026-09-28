/**
 * HTTP helpers for saas-web Playwright (API Fake + seed).
 */
import { API_BASE, PLATFORM } from "./selectors";

export async function json(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function platformLogin(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: PLATFORM.email,
      password: PLATFORM.password,
      organization_slug: PLATFORM.orgSlug,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `platform login ${res.status}: ${JSON.stringify(await json(res))}`,
    );
  }
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export function makeValidUniqueRuc(seed: number): string {
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
  const base = String(20_000_000_00 + (seed % 1_000_000_000))
    .padStart(10, "0")
    .slice(0, 10);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(base[i]) * weights[i]!;
  }
  const mod = 11 - (sum % 11);
  const check = mod === 10 ? 0 : mod === 11 ? 1 : mod;
  return `${base}${check}`;
}

export async function createPublicSignup(input: {
  companyName: string;
  ruc: string;
  contactEmail: string;
  contactName?: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/saas/public/signup-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: input.companyName,
      ruc: input.ruc,
      contact_name: input.contactName ?? "E2E Contact",
      contact_email: input.contactEmail,
      plan_code: "starter",
      accept_privacy: true,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `signup create ${res.status}: ${JSON.stringify(await json(res))}`,
    );
  }
  return (await res.json()) as { id: string };
}

export async function waitInviteToken(
  platformToken: string,
  email: string,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${API_BASE}/saas/notifications?limit=50`,
      { headers: { Authorization: `Bearer ${platformToken}` } },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        items: Array<{
          template_code?: string;
          to_email?: string;
          status?: string;
          payload?: { invite_token?: string } | null;
        }>;
      };
      const hit = body.items.find(
        (i) =>
          i.template_code === "invite.owner" &&
          i.to_email === email &&
          i.status === "success" &&
          i.payload?.invite_token,
      );
      if (hit?.payload?.invite_token) {
        return hit.payload.invite_token;
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`invite.owner token not found for ${email}`);
}

export async function publishNewLegal(
  platformToken: string,
  code: "privacy.es-PE" | "terms.es-PE",
): Promise<void> {
  const stamp = Date.now();
  const created = await fetch(`${API_BASE}/saas/legal/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${platformToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      version: 2000 + (stamp % 100_000),
      title: `E2E ${code} ${stamp}`,
      body_md: `# E2E legal bump\n\nUpdated at ${new Date().toISOString()}`,
    }),
  });
  if (!created.ok) {
    throw new Error(
      `legal create ${created.status}: ${JSON.stringify(await json(created))}`,
    );
  }
  const doc = (await created.json()) as { id: string };
  const pub = await fetch(
    `${API_BASE}/saas/legal/documents/${doc.id}/publish`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${platformToken}` },
    },
  );
  if (!pub.ok) {
    throw new Error(
      `legal publish ${pub.status}: ${JSON.stringify(await json(pub))}`,
    );
  }
}
