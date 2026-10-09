import { afterEach, expect, it, vi } from "vitest";
import { FactosysClient } from "./client";
afterEach(() => vi.unstubAllGlobals());
it("exposes tools, safe deletion, QR and identifier/ticket operations", async () => {
  const fetch = vi.fn(
    async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({ apiKey: "fixture", baseUrl: "https://example.invalid" });
  await client.companyTools.encodeFile(new Blob([new Uint8Array([0, 255])]), "fixture.bin");
  await client.companyTools.convertCertificate("fixture", "password");
  await client.companies.remove("company", true);
  await client.documents.getByIdentifiers("company", "01", "F001", 1);
  await client.documents.getByTicket("company", "ticket&1");
  await client.documents.recoverCdrByIdentifiers("company", "01", "F001", 1);
  expect(fetch.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
  expect(fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Content-Type");
  expect(fetch.mock.calls[2]?.[0]).toBe(
    "https://example.invalid/v1/companies/company?permanent=true",
  );
  expect(fetch.mock.calls[2]?.[1]?.method).toBe("DELETE");
  expect(fetch.mock.calls[4]?.[0]).toContain("ticket=ticket%261");
  expect(fetch.mock.calls[5]?.[1]?.method).toBe("POST");
});
it("returns QR and decoded file bytes without JSON parsing", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(new Uint8Array([0, 255]), {
        headers: { "Content-Type": "application/octet-stream" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({ apiKey: "fixture", baseUrl: "https://example.invalid" });
  expect(new Uint8Array(await client.companyTools.decodeFile("AP8="))).toEqual(
    new Uint8Array([0, 255]),
  );
  await client.sale.getQr({
    company_id: "company",
    tipo: "01",
    serie: "F001",
    numero: "1",
    emision: "2026-10-09",
    igv: 18,
    total: 118,
    clienteTipo: "6",
    clienteNumero: "20100070970",
  });
  expect(fetch.mock.calls[1]?.[0]).toBe("https://example.invalid/v1/sale/qr");
});
