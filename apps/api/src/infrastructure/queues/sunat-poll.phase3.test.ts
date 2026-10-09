import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import { greCdrFixture, TEST_GRE_QR } from "../../../../../packages/sunat-gre/test-fixtures/cdr";
import { SunatPollProcessor } from "./sunat-poll.processor";
import { envSchema, type Env } from "../config/env.schema";
import type { QueueJobData } from "./queue.tokens";
import type { DocumentsService } from "../documents/documents.service";
import type { CredentialsResolver } from "../documents/credentials-resolver";
import type { GreTokenCacheService } from "../gre/gre-token-cache.service";

function fixture(result: unknown, attempt = 0) {
  const docs = {
    getById: vi.fn().mockResolvedValue({
      documentType: "09",
      serieNumber: "T001-00000001",
      status: "ticket_pending",
      sunatTicket: "ticket",
      payload: { _canonical: { supplier: { identity_number: "20601234567" } } },
    }),
    putArtifact: vi.fn(),
    transitionStatus: vi.fn(),
    patchPayload: vi.fn(),
    appendEvent: vi.fn(),
  };
  const processor = new SunatPollProcessor(
    docs as unknown as DocumentsService,
    {} as CredentialsResolver,
    { getAccessToken: async () => "fixture" } as GreTokenCacheService,
    new ConfigService<Env, true>(envSchema.parse({ NODE_ENV: "test", SUNAT_GRE_MODE: "beta" })),
  );
  const getStatus = vi.fn().mockResolvedValue(result);
  Object.assign(processor, { greDespatch: { getStatus } });
  const job = {
    data: { organizationId: "org", companyId: "company", documentId: "doc" },
    attemptsMade: attempt,
    opts: { attempts: 8 },
  } as Job<QueueJobData>;
  return { docs, processor, getStatus, job };
}
describe("GRE bounded polling and CDR ownership", () => {
  it("uses CDR observations, stores official QR and CDR before accepting", async () => {
    const f = fixture({
      status: "accepted",
      rawCdrZip: greCdrFixture("0", undefined, undefined, "Observacion"),
    });
    await expect(f.processor.process(f.job)).resolves.toEqual({
      ok: true,
      status: "accepted_with_observation",
    });
    expect(f.docs.patchPayload).toHaveBeenCalledWith(
      "doc",
      expect.objectContaining({
        _gre: expect.objectContaining({ qr_url: TEST_GRE_QR, qr_source: "sunat_cdr" }),
      }),
    );
    expect(f.docs.putArtifact).toHaveBeenCalledTimes(1);
    expect(f.docs.transitionStatus).toHaveBeenCalledWith(
      "doc",
      "ticket_pending",
      "accepted_with_observation",
      expect.objectContaining({ sunatResponseCode: "0" }),
    );
  });
  it("never accepts another document's CDR", async () => {
    const f = fixture({ status: "accepted", rawCdrZip: greCdrFixture("0", "T001-2") });
    await expect(f.processor.process(f.job)).rejects.toThrow("identity");
    expect(f.docs.transitionStatus).not.toHaveBeenCalled();
    expect(f.docs.putArtifact).not.toHaveBeenCalled();
  });
  it("retries without CDR then marks reconciliation after eight attempts", async () => {
    const f = fixture({ status: "accepted" }, 7);
    await expect(f.processor.process(f.job)).resolves.toEqual({
      ok: true,
      status: "ticket_pending",
    });
    expect(f.docs.patchPayload).toHaveBeenCalledWith("doc", {
      _gre: expect.objectContaining({
        reason: "poll_exhausted",
        poll_attempts: 8,
        reconciliation_required: true,
      }),
    });
    expect(f.getStatus).toHaveBeenCalledTimes(1);
    expect(f.docs.transitionStatus).not.toHaveBeenCalled();
  });
  it("records rejection without requiring a CDR", async () => {
    const f = fixture({ status: "rejected", sunatCode: "2345", sunatMessage: "Error" });
    await expect(f.processor.process(f.job)).resolves.toEqual({ ok: true, status: "rejected" });
    expect(f.docs.patchPayload).toHaveBeenCalledWith("doc", {
      _gre: expect.objectContaining({ qr_url: undefined }),
    });
  });
});
