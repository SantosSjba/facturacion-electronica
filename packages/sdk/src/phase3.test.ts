import { afterEach, expect, it, vi } from "vitest";
import { FactosysClient } from "./client";
import { greScenario } from "../../sunat-ubl/test-fixtures/gre-scenarios";
afterEach(() => vi.unstubAllGlobals());
it("emits GRE with idempotency and resumes ticket queries without another emission", async () => {
  const fetch = vi.fn(
    async () => new Response("{}", { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({ apiKey: "fixture", baseUrl: "https://example.com/v1" });
  const { number, supplier, supplier_party, ...canonical } = greScenario();
  void number;
  void supplier;
  void supplier_party;
  await client.despatchAdvices.create({ ...canonical, company_id: "company" }, "gre-key");
  await client.despatchAdvices.reconcileTicket("doc", "11111111-1111-4111-8111-111111111111");
  expect(fetch.mock.calls[0]?.[0]).toBe("https://example.com/v1/despatch-advices");
  expect(fetch.mock.calls[0]?.[1]?.headers["Idempotency-Key"]).toBe("gre-key");
  expect(fetch.mock.calls[1]?.[0]).toBe(
    "https://example.com/v1/despatch-advices/doc/reconcile-ticket",
  );
});
