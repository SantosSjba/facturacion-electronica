/**
 * FE-314 verify:dod — HTTP smoke of product DoD (03 §3) against a running Fake API.
 *
 * Prereqs: migrate + seed, API up (SUNAT_*=fake, PDF_RI_MODE=fake).
 * Usage: pnpm verify:dod
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { generateTestPfx } = require(
  join(root, "packages/sunat-sign/dist/index.js"),
);

const BASE = (process.env.FACTOSYS_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS  ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, err: String(err) });
  console.error(`FAIL  ${name}: ${err}`);
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function main() {
  // 0 health + ruleset
  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) throw new Error(`health ${h.status}`);
    const r = await fetch(`${BASE}/meta/ruleset`);
    if (!r.ok) throw new Error(`ruleset ${r.status}`);
    const body = await r.json();
    if (!body.ruleset_version) throw new Error("missing ruleset_version");
    pass("health + ruleset");
  } catch (e) {
    fail("health + ruleset", e);
  }

  let jwt;
  try {
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
    jwt = (await loginRes.json()).access_token;
    pass("owner login");
  } catch (e) {
    fail("owner login", e);
    summarize();
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${jwt}` };

  let companyId;
  try {
    const companiesRes = await fetch(`${BASE}/companies`, { headers: auth });
    const companies = await companiesRes.json();
    companyId = companies.find((c) => c.environment === "sandbox")?.id;
    if (!companyId) {
      const created = await fetch(`${BASE}/companies`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          ruc: "20100070970",
          legal_name: "DoD Verify Co",
          environment: "sandbox",
        }),
      });
      if (!created.ok) throw new Error(`company ${created.status}`);
      companyId = (await created.json()).id;
    }

    const password = "DemoPfx1!";
    const { pfx } = generateTestPfx(password);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(pfx)]), "demo.pfx");
    form.append("password", password);
    await fetch(`${BASE}/companies/${companyId}/certificate`, {
      method: "PUT",
      headers: auth,
      body: form,
    });
    await fetch(`${BASE}/companies/${companyId}/sol-credentials`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "20100070970MODDATOS",
        password: "sol-secret",
      }),
    });

    const seriesRes = await fetch(`${BASE}/companies/${companyId}/series`, {
      headers: auth,
    });
    const series = await seriesRes.json();
    const hasF001 = series.some(
      (s) =>
        s.serie === "F001" &&
        (s.documentType === "01" || s.document_type === "01"),
    );
    if (!hasF001) {
      const post = await fetch(`${BASE}/companies/${companyId}/series`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: "01",
          serie: "F001",
          next_number: 1,
        }),
      });
      if (!post.ok) throw new Error(`series ${post.status}`);
    }
    pass("1 company + cert + SOL + F001");
  } catch (e) {
    fail("1 company + cert + SOL + F001", e);
  }

  let apiKey;
  let docId;
  try {
    const keyRes = await fetch(`${BASE}/organizations/me/api-keys`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `dod-${Date.now()}`,
        scopes: [
          "documents:read",
          "documents:write",
          "webhooks:manage",
          "validations:cpe",
        ],
      }),
    });
    if (!keyRes.ok) throw new Error(`api-key ${keyRes.status}`);
    apiKey = (await keyRes.json()).secret;

    const invRes = await fetch(`${BASE}/v1/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `dod-inv-${Date.now()}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        serie: "F001",
        operation_type: "0101",
        issue_date: "2026-09-17",
        currency: "PEN",
        totals_mode: "auto",
        customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME DoD",
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "DoD verify line",
            unit_value: 100,
            unit_price: 118,
            tax_affectation: "10",
            igv_percent: 18,
            tax_scheme_id: "1000",
          },
        ],
      }),
    });
    if (!invRes.ok) {
      throw new Error(`invoice ${invRes.status} ${JSON.stringify(await json(invRes))}`);
    }
    const created = await invRes.json();
    docId = created.id;
    let status = created.status;
    for (let i = 0; i < 40 && (status === "queued" || status === "sent"); i++) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await fetch(`${BASE}/v1/documents/${docId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      status = (await got.json()).status;
    }
    if (!["accepted", "accepted_with_observation"].includes(status)) {
      throw new Error(`status ${status}`);
    }
    pass("2 factura 01 → accepted");
  } catch (e) {
    fail("2 factura 01 → accepted", e);
  }

  if (docId && apiKey) {
    try {
      for (const kind of ["xml", "cdr"]) {
        const res = await fetch(`${BASE}/v1/documents/${docId}/${kind}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) throw new Error(`${kind} ${res.status}`);
      }
      pass("2 xml + cdr");
    } catch (e) {
      fail("2 xml + cdr", e);
    }

    try {
      const pdfRes = await fetch(`${BASE}/v1/documents/${docId}/pdf`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      if (buf.subarray(0, 5).toString("utf8") !== "%PDF-") {
        throw new Error("missing PDF magic");
      }
      pass("9 PDF magic");
    } catch (e) {
      fail("9 PDF magic", e);
    }
  }

  try {
    const cpeRes = await fetch(`${BASE}/v1/validations/cpe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: companyId,
        ruc: "20100070970",
        document_type: "01",
        serie: "F001",
        number: "1",
        issue_date: "2026-09-17",
        total_amount: 118,
      }),
    });
    if (!cpeRes.ok) throw new Error(`cpe ${cpeRes.status}`);
    const first = await cpeRes.json();
    const cpe2 = await fetch(`${BASE}/v1/validations/cpe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: companyId,
        ruc: "20100070970",
        document_type: "01",
        serie: "F001",
        number: "1",
        issue_date: "2026-09-17",
        total_amount: 118,
      }),
    });
    const second = await cpe2.json();
    if (!first.cpe_status) throw new Error("missing cpe_status");
    if (second.cached !== true) throw new Error("expected cached:true");
    pass("7 validez CPE + cache");
  } catch (e) {
    fail("7 validez CPE + cache", e);
  }

  try {
    const wh = await fetch(`${BASE}/v1/webhook-endpoints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/factosys-dod-hook",
        events: ["document.status_changed"],
      }),
    });
    if (!wh.ok) throw new Error(`webhook ${wh.status} ${JSON.stringify(await json(wh))}`);
    const body = await wh.json();
    if (!body.secret || !body.id) throw new Error("missing secret/id");
    pass("8 webhook create");
  } catch (e) {
    fail("8 webhook create", e);
  }

  console.log(
    "\nNote: items 3–6 (boleta/RC, NC/ND, RA, GRE) covered by API e2e + console wizards; see docs/dod-producto-mvp.md",
  );
  summarize();
  if (results.some((r) => !r.ok)) process.exit(1);
}

function summarize() {
  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDoD verify: ${ok}/${results.length} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
