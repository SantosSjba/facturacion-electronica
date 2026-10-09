import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URLSearchParams } from "node:url";
import { phase1Scenarios } from "../packages/sunat-ubl/test-fixtures/commercial-scenarios.ts";
import { greScenario } from "../packages/sunat-ubl/test-fixtures/gre-scenarios.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs/integracion/cases");
fs.mkdirSync(dir, { recursive: true });
const company = "00000000-0000-4000-8000-000000000001";
const names = [
  "credito-cuotas",
  "descuentos-cargos",
  "anticipo-aplicacion",
  "detraccion",
  "icbper",
  "isc-sistema-01",
  "isc-sistema-02",
  "isc-sistema-03",
  "ivap",
  "exportacion",
  "detraccion-hidrobiologia",
  "detraccion-pasajeros",
  "detraccion-carga",
  "anticipo-isc",
];
const cases = phase1Scenarios().map((raw, i) => {
  const { number, document_type, ...body } = raw;
  void number;
  void document_type;
  const name = `01-${String(i + 1).padStart(2, "0")}-${names[i] ?? "comercial"}.json`;
  const request = { ...body, company_id: company };
  fs.writeFileSync(path.join(dir, name), JSON.stringify(request, null, 2) + "\n");
  return { name, path: "/v1/invoices", request };
});
for (const kind of ["public", "private", "m1", "carrier", "export"]) {
  const { number, supplier, supplier_party, ...body } = greScenario(kind);
  void number;
  void supplier;
  void supplier_party;
  const request = { ...body, company_id: company },
    name = `gre-${kind}.json`;
  fs.writeFileSync(path.join(dir, name), JSON.stringify(request, null, 2) + "\n");
  cases.push({ name, path: "/v1/despatch-advices", request });
}
const add = (name, route, request) => {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(request, null, 2) + "\n");
  cases.push({ name, path: route, request });
};
const receipt = {
  ...cases[0].request,
  serie: "B001",
  payment_terms: undefined,
  send_individually: true,
  include_in_daily_summary: false,
};
add("boleta.json", "/v1/receipts", receipt);
for (const [name, route] of [
  ["nota-devolucion", "credit-notes"],
  ["nota-descuento", "credit-notes"],
  ["nota-debito", "debit-notes"],
  ["nota-cuotas", "credit-notes"],
]) {
  const request = JSON.parse(
    fs.readFileSync(path.join(root, "docs/examples/phase1", name + ".json"), "utf8"),
  );
  add(name + ".json", "/v1/" + route, { ...request, company_id: company });
}
add("resumen-diario.json", "/v1/daily-summaries", {
  company_id: company,
  reference_date: "2026-10-08",
  document_ids: [company],
});
add("baja-factura.json", "/v1/voided-documents", {
  company_id: company,
  reference_date: "2026-10-08",
  documents: [{ document_type: "01", serie_number: "F001-1", reason: "Error de emisión" }],
});
const entry = (name, method, url, body, idempotent = false) => ({
  name,
  request: {
    method,
    header: [
      { key: "Authorization", value: "Bearer {{api_key}}" },
      ...(body ? [{ key: "Content-Type", value: "application/json" }] : []),
      ...(idempotent ? [{ key: "Idempotency-Key", value: "{{idempotency_key}}" }] : []),
    ],
    url: {
      raw: "{{base_url}}" + url,
      host: ["{{base_url}}"],
      path: url.split("?")[0].slice(1).split("/"),
      ...(url.includes("?")
        ? {
            query: [...new URLSearchParams(url.split("?")[1])].map(([key, value]) => ({
              key,
              value,
            })),
          }
        : {}),
    },
    ...(body
      ? {
          body: {
            mode: "raw",
            raw: JSON.stringify(body, null, 2),
            options: { raw: { language: "json" } },
          },
        }
      : {}),
  },
});
const collection = {
  info: {
    name: "Factosys Fase 4",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description:
      "Pruebas de integración; configure variables, use sandbox y keys distintas por solicitud. CDR fixtures no acreditan aceptación real.",
  },
  variable: [
    { key: "base_url", value: "http://localhost:3000" },
    { key: "api_key", value: "" },
    { key: "company_id", value: company },
    { key: "document_id", value: company },
    { key: "share_id", value: company },
    { key: "series_id", value: company },
    { key: "delivery_id", value: company },
    { key: "share_token", value: "" },
    { key: "sol_username", value: "" },
    { key: "sol_password", value: "" },
    { key: "gre_client_id", value: "" },
    { key: "gre_client_secret", value: "" },
    { key: "idempotency_key", value: "replace-for-each-new-request" },
  ],
  item: [
    entry("Capacidades", "GET", "/v1/capabilities"),
    entry("Empresas", "GET", "/v1/companies"),
    entry("Crear empresa", "POST", "/v1/companies", {
      ruc: "20100070970",
      legal_name: "EMPRESA DE PRUEBA",
      environment: "sandbox",
      seed_default_series: true,
    }),
    {
      name: "Casos comerciales y GRE",
      item: cases.map((c) =>
        entry(c.name, "POST", c.path, { ...c.request, company_id: "{{company_id}}" }, true),
      ),
    },
    entry(
      "Consulta filtrada",
      "GET",
      "/v1/documents?company_id={{company_id}}&document_type=01&serie_number=F001-1",
    ),
    entry("Consultar empresa", "GET", "/v1/companies/{{company_id}}"),
    entry("Configurar PDF", "PATCH", "/v1/companies/{{company_id}}", { pdf_format: "TICKET80" }),
    entry("Series", "GET", "/v1/companies/{{company_id}}/series"),
    entry("Crear serie", "POST", "/v1/companies/{{company_id}}/series", {
      document_type: "01",
      serie: "F002",
    }),
    entry("Configurar serie", "PATCH", "/v1/companies/{{company_id}}/series/{{series_id}}", {
      padding: 8,
    }),
    entry("Rotar SOL", "PUT", "/v1/companies/{{company_id}}/sol-credentials", {
      username: "{{sol_username}}",
      password: "{{sol_password}}",
    }),
    entry("Rotar OAuth GRE", "PUT", "/v1/companies/{{company_id}}/gre-credentials", {
      client_id: "{{gre_client_id}}",
      client_secret: "{{gre_client_secret}}",
    }),
    entry("Revocar SOL", "DELETE", "/v1/companies/{{company_id}}/credentials/sol"),
    entry("Estado y artefactos", "GET", "/v1/documents/{{document_id}}"),
    entry("Recuperar CDR", "POST", "/v1/documents/{{document_id}}/recover-cdr"),
    entry(
      "Entregar correo",
      "POST",
      "/v1/documents/{{document_id}}/deliveries",
      { recipients: ["destinatario@example.invalid"] },
      true,
    ),
    entry("Reconciliar GRE", "POST", "/v1/despatch-advices/{{document_id}}/reconcile-ticket"),
    entry(
      "Reintento autorizado de correo",
      "POST",
      "/v1/documents/{{document_id}}/deliveries/{{delivery_id}}/retry",
      { reason: "Reenvío revisado por soporte" },
    ),
    entry("Consultar entregas", "GET", "/v1/documents/{{document_id}}/deliveries"),
    entry("Compartir PDF", "POST", "/v1/documents/{{document_id}}/shares", {
      allowed_artifacts: ["pdf"],
      ttl_seconds: 3600,
    }),
    entry("Listar enlaces", "GET", "/v1/documents/{{document_id}}/shares"),
    {
      ...entry("Consulta de destinatario", "GET", "/v1/shared-documents/{{share_token}}"),
      request: { ...entry("", "GET", "/v1/shared-documents/{{share_token}}").request, header: [] },
    },
    entry("Revocar enlace", "DELETE", "/v1/documents/{{document_id}}/shares/{{share_id}}"),
    entry("Consultar traza", "GET", "/v1/documents/{{document_id}}/trace"),
    ...["xml", "pdf", "cdr", "qr"].map((kind) =>
      entry("Archivo " + kind, "GET", `/v1/documents/{{document_id}}/${kind}`),
    ),
  ],
};
fs.writeFileSync(
  path.join(root, "docs/integracion/factosys.postman_collection.json"),
  JSON.stringify(collection, null, 2) + "\n",
);
console.log(`Generated ${cases.length} examples and Postman collection. No network requests.`);
