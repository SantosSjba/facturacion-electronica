import { afterEach, expect, it, vi } from "vitest";
import { FactosysClient } from "./client";
import { taxAgentRequest } from "../../sunat-ubl/test-fixtures/tax-agent-scenarios";
afterEach(() => vi.unstubAllGlobals());
it("supports independent tax-agent documents, RR and ticket recovery using shared authentication and idempotency", async () => {
  const fetch = vi.fn(
    async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({ apiKey: "fixture", baseUrl: "https://example.invalid/v1" });
  await client.retentions.create(
    { ...taxAgentRequest("20"), company_id: "company" },
    "retention-event",
  );
  await client
    .withIdempotencyKey("perception-event")
    .perceptions.create({ ...taxAgentRequest("40"), company_id: "company" });
  await client.reversions.create(
    {
      company_id: "company",
      document_type: "20",
      issue_date: "2026-10-08",
      reference_date: "2026-10-08",
      communicated_on: "2026-10-08",
      documents: [{ document_id: "doc", reason: "Error" }],
    },
    "reversion-event",
  );
  await client.reversions.reconcileTicket("doc/1");
  expect(fetch.mock.calls.map((c) => c[0])).toEqual([
    "https://example.invalid/v1/retentions",
    "https://example.invalid/v1/perceptions",
    "https://example.invalid/v1/reversions",
    "https://example.invalid/v1/reversions/doc%2F1/reconcile-ticket",
  ]);
  expect(fetch.mock.calls[0]?.[1]?.headers).toHaveProperty("Idempotency-Key", "retention-event");
  expect(fetch.mock.calls[1]?.[1]?.headers).toHaveProperty("Idempotency-Key", "perception-event");
  expect(fetch.mock.calls[2]?.[1]?.headers).toHaveProperty("Idempotency-Key", "reversion-event");
});
