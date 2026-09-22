/**
 * Demo MVP API (S9-05 / alcance 03 §3): emit factura Fake → poll accepted → PDF.
 *
 * Prereqs: docker compose up (postgres/redis/minio), pnpm db:migrate && pnpm db:seed,
 * API running on FACTOSYS_BASE_URL (default http://127.0.0.1:3000).
 *
 * Usage: pnpm demo:api-mvp
 */
import { generateTestPfx } from "@factosys/sunat-sign";

const BASE = (process.env.FACTOSYS_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

async function json(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function main(): Promise<void> {
  console.log("[demo] base", BASE);

  const ruleset = await fetch(`${BASE}/meta/ruleset`);
  if (!ruleset.ok) throw new Error(`meta/ruleset ${ruleset.status}`);
  const rulesetBody = (await ruleset.json()) as { ruleset_version: string };
  console.log("[demo] ruleset", rulesetBody.ruleset_version);

  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "owner@demo.local",
      password: "DemoOwner!2026",
      organization_slug: "demo",
    }),
  });
  if (!loginRes.ok) throw new Error(`login ${loginRes.status}`);
  const login = (await loginRes.json()) as { access_token: string };
  const jwt = login.access_token;

  const companiesRes = await fetch(`${BASE}/companies`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const companies = (await companiesRes.json()) as {
    id: string;
    environment: string;
  }[];
  let companyId = companies.find((c) => c.environment === "sandbox")?.id;
  if (!companyId) {
    const created = await fetch(`${BASE}/companies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ruc: "20100070970",
        legal_name: "Demo Co Sandbox",
        environment: "sandbox",
      }),
    });
    const body = (await created.json()) as { id?: string };
    companyId = body.id;
  }
  if (!companyId) throw new Error("no company");

  const password = "DemoPfx1!";
  const { pfx } = generateTestPfx(password);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(pfx)]), "demo.pfx");
  form.append("password", password);
  await fetch(`${BASE}/companies/${companyId}/certificate`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  await fetch(`${BASE}/companies/${companyId}/sol-credentials`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "20100070970MODDATOS",
      password: "sol-secret",
    }),
  });

  const seriesRes = await fetch(`${BASE}/companies/${companyId}/series`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const series = (await seriesRes.json()) as {
    serie: string;
    documentType: string;
  }[];
  if (!series.some((s) => s.serie === "F001" && s.documentType === "01")) {
    await fetch(`${BASE}/companies/${companyId}/series`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: "01",
        serie: "F001",
        next_number: 1,
      }),
    });
  }

  const keyRes = await fetch(`${BASE}/organizations/me/api-keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `demo-${Date.now()}`,
      scopes: ["documents:read", "documents:write"],
    }),
  });
  const keyBody = (await keyRes.json()) as { secret: string };
  const apiKey = keyBody.secret;

  const invoiceBody = {
    company_id: companyId,
    serie: "F001",
    operation_type: "0101",
    issue_date: "2026-09-17",
    currency: "PEN",
    totals_mode: "auto",
    customer: {
      identity_type: "6",
      identity_number: "20123456789",
      name: "ACME SAC",
    },
    lines: [
      {
        id: 1,
        quantity: 1,
        unit_code: "NIU",
        description: "Demo factura gravada",
        unit_value: 100,
        unit_price: 118,
        tax_affectation: "10",
        igv_percent: 18,
        tax_scheme_id: "1000",
      },
    ],
  };

  const createdRes = await fetch(`${BASE}/v1/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `demo-inv-${Date.now()}`,
    },
    body: JSON.stringify(invoiceBody),
  });
  if (!createdRes.ok) {
    throw new Error(`invoice ${createdRes.status} ${JSON.stringify(await json(createdRes))}`);
  }
  const created = (await createdRes.json()) as {
    id: string;
    status: string;
    serie_number: string;
  };
  console.log("[demo] created", created.id, created.serie_number, created.status);

  let status = created.status;
  for (let i = 0; i < 40 && (status === "queued" || status === "sent"); i++) {
    await new Promise((r) => setTimeout(r, 250));
    const got = await fetch(`${BASE}/v1/documents/${created.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const doc = (await got.json()) as { status: string };
    status = doc.status;
  }
  console.log("[demo] terminal status", status);
  if (!["accepted", "accepted_with_observation"].includes(status)) {
    throw new Error(`unexpected status ${status}`);
  }

  const pdfRes = await fetch(`${BASE}/v1/documents/${created.id}/pdf`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  console.log(
    "[demo] pdf",
    pdfRes.status,
    pdfBuf.subarray(0, 5).toString("utf8"),
    `${pdfBuf.length} bytes`,
  );
  if (pdfBuf.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new Error("PDF magic missing");
  }

  console.log("[demo] OK — MVP API smoke (Fake CDR) passed");
}

main().catch((err) => {
  console.error("[demo] FAILED", err);
  process.exit(1);
});
