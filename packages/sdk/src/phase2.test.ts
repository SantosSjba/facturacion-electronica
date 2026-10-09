import { it, expect, vi, afterEach } from "vitest";
import { FactosysClient } from "./client";
import { phase1Request } from "../../sunat-ubl/test-fixtures/commercial-scenarios";
afterEach(() => vi.unstubAllGlobals());
it("sends typed previews without a required idempotency key and exposes both QR resources", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(
      async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({ apiKey: "test", baseUrl: "https://example.com/v1" });
  await client.previews.validate({
    document_type: "01",
    document: { ...phase1Request(), pdf_format: "A5" },
  });
  const req = fetch.mock.calls[0]?.[1];
  expect(req.headers["Idempotency-Key"]).toBeUndefined();
  expect(JSON.parse(req.body).document.pdf_format).toBe("A5");
  await client.documents.getQr("doc");
  await client.documents.getQrImage("doc");
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    "https://example.com/v1/previews/validate",
    "https://example.com/v1/documents/doc/qr",
    "https://example.com/v1/documents/doc/qr.png",
  ]);
});
