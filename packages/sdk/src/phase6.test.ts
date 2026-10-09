import { afterEach, expect, it, vi } from "vitest";
import { FactosysClient } from "./client";
import { encodeCpeTxt } from "./helpers/cpe-txt";
afterEach(() => vi.unstubAllGlobals());
it("sends TXT as raw UTF-8 with shared authentication, routes and idempotency", async () => {
  const fetch = vi.fn(
    async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({
    apiKey: "fixture",
    baseUrl: "https://example.invalid/v1",
  }).withIdempotencyKey("same-event");
  for (const type of ["01", "03", "07", "08"] as const) {
    const text = encodeCpeTxt(type, {
      customer: { name: "Ñ | cliente" },
      lines: [{ description: "A\nB" }],
    });
    await client.txt.create(type, text);
    expect(fetch.mock.lastCall?.[1]).toMatchObject({
      method: "POST",
      body: text,
      headers: {
        Authorization: "Bearer fixture",
        "Idempotency-Key": "same-event",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    "https://example.invalid/v1/invoices",
    "https://example.invalid/v1/receipts",
    "https://example.invalid/v1/credit-notes",
    "https://example.invalid/v1/debit-notes",
  ]);
  await expect(client.request("/v1/invoices", { body: {}, textBody: "text" })).rejects.toThrow(
    "mutually exclusive",
  );
});
