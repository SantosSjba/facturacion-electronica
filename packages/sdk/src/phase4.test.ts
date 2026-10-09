import { afterEach, expect, it, vi } from "vitest";
import { FactosysClient } from "./client";
afterEach(() => vi.unstubAllGlobals());
it("supports onboarding, credential multipart, deduplicated delivery, recovery and revocable shares", async () => {
  const fetch = vi.fn(
    async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({ apiKey: "fixture", baseUrl: "https://example.invalid/v1" });
  await client.companies.create({
    ruc: "20100070970",
    legal_name: "Fixture",
    environment: "sandbox",
  });
  await client.companies.putCertificate("company", new Blob(["fixture"]), "test-only");
  await client.documents.deliver("doc", ["fixture@example.invalid"], "delivery-event");
  await client.documents.createShare("doc", ["pdf"], 3600);
  await client.documents.revokeShare("doc", "share");
  await client.documents.recoverCdr("doc");
  expect(fetch.mock.calls[1]?.[1]?.body).toBeInstanceOf(FormData);
  expect(fetch.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Content-Type");
  expect(fetch.mock.calls[2]?.[1]?.headers).toHaveProperty("Idempotency-Key", "delivery-event");
  expect(fetch.mock.calls[4]?.[1]?.method).toBe("DELETE");
  expect(fetch.mock.calls[5]?.[0]).toBe("https://example.invalid/v1/documents/doc/recover-cdr");
});
it("does not automatically repeat a non-idempotent share creation after a server failure", async () => {
  const fetch = vi.fn(
    async () =>
      new Response('{"code":"FACTOSYS_INTERNAL","message":"fixture","retryable":true}', {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new FactosysClient({
    apiKey: "fixture",
    baseUrl: "https://example.invalid",
    maxRetries: 3,
  });
  await expect(client.documents.createShare("doc")).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
