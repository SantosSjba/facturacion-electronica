/**
 * Provision sandbox company + cert + SOL + F001 for emit E2E.
 * Mirrors scripts/demo-api-mvp.mjs (HTTP only).
 */
import { generateTestPfx } from "@factosys/sunat-sign";

import { API_BASE, DEMO } from "./helpers/selectors";

async function json(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
}

export default async function globalSetup(): Promise<void> {
  const health = await fetch(`${API_BASE}/health`);
  if (!health.ok) {
    throw new Error(
      `API not reachable at ${API_BASE}/health (${health.status}). Start the API before console e2e.`,
    );
  }

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: DEMO.owner.email,
      password: DEMO.owner.password,
      organization_slug: DEMO.org,
    }),
  });
  if (!loginRes.ok) {
    throw new Error(
      `owner login failed ${loginRes.status}: ${JSON.stringify(await json(loginRes))}`,
    );
  }
  const login = (await loginRes.json()) as { access_token: string };
  const jwt = login.access_token;
  const auth = { Authorization: `Bearer ${jwt}` };

  const companiesRes = await fetch(`${API_BASE}/companies`, { headers: auth });
  const companies = (await companiesRes.json()) as {
    id: string;
    environment: string;
  }[];
  let companyId = companies.find((c) => c.environment === "sandbox")?.id;
  if (!companyId) {
    const created = await fetch(`${API_BASE}/companies`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        ruc: "20100070970",
        legal_name: "E2E Demo Co Sandbox",
        environment: "sandbox",
      }),
    });
    if (!created.ok) {
      throw new Error(
        `create company ${created.status}: ${JSON.stringify(await json(created))}`,
      );
    }
    companyId = (await created.json() as { id: string }).id;
  }

  const password = "DemoPfx1!";
  const { pfx } = generateTestPfx(password);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(pfx)]), "demo.pfx");
  form.append("password", password);
  const certRes = await fetch(`${API_BASE}/companies/${companyId}/certificate`, {
    method: "PUT",
    headers: auth,
    body: form,
  });
  if (!certRes.ok && certRes.status !== 204) {
    // already configured is fine if PUT rejects duplicate; try continue
    const body = await certRes.text();
    if (certRes.status >= 500) {
      throw new Error(`certificate ${certRes.status}: ${body.slice(0, 200)}`);
    }
  }

  await fetch(`${API_BASE}/companies/${companyId}/sol-credentials`, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "20100070970MODDATOS",
      password: "sol-secret",
    }),
  });

  const seriesRes = await fetch(`${API_BASE}/companies/${companyId}/series`, {
    headers: auth,
  });
  const series = (await seriesRes.json()) as {
    serie: string;
    documentType?: string;
    document_type?: string;
  }[];
  const hasF001 = series.some(
    (s) =>
      s.serie === "F001" &&
      (s.documentType === "01" || s.document_type === "01"),
  );
  if (!hasF001) {
    const post = await fetch(`${API_BASE}/companies/${companyId}/series`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        document_type: "01",
        serie: "F001",
        next_number: 1,
      }),
    });
    if (!post.ok) {
      throw new Error(
        `create series ${post.status}: ${JSON.stringify(await json(post))}`,
      );
    }
  }

  // Expose company id for specs via env (Playwright workers inherit process.env)
  process.env.E2E_COMPANY_ID = companyId;
  console.log(`[e2e globalSetup] company ${companyId} ready at ${API_BASE}`);
}
