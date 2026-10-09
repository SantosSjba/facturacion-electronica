import { afterEach, describe, it, expect, vi } from "vitest";
import { FactosysClient } from "./client";
import { phase1Scenarios, phase1Request } from "../../sunat-ubl/test-fixtures/commercial-scenarios";
afterEach(() => vi.unstubAllGlobals());
describe("commercial SDK requests", () => {
  it("preserves commercial fields and idempotency", async () => {
    const fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: "document", status: "queued" }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = new FactosysClient({ apiKey: "test", baseUrl: "https://api.example.com" });
    for (const body of phase1Scenarios()) await client.invoices.create(body, "same-operation");
    for (const [index, body] of phase1Scenarios().entries()) {
      const request = fetch.mock.calls[index]?.[1];
      expect(JSON.parse(request.body)).toEqual(JSON.parse(JSON.stringify(body)));
      expect(request.headers["Idempotency-Key"]).toBe("same-operation");
    }
    const body = {
      ...phase1Request(),
      note_type: "05",
      reason: "Descuento",
      affected_document: { document_type: "01" as const, serie_number: "F001-1" },
    };
    await client.creditNotes.create(body, "credit");
    await client.debitNotes.create({ ...body, note_type: "02" }, "debit");
    expect(fetch.mock.calls.at(-2)?.[0]).toBe("https://api.example.com/v1/credit-notes");
    expect(fetch.mock.calls.at(-1)?.[0]).toBe("https://api.example.com/v1/debit-notes");
  });
});
