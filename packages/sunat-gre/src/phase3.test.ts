import { describe, expect, it, vi } from "vitest";
import AdmZip from "adm-zip";
import { greCdrFixture, TEST_GRE_QR } from "../test-fixtures/cdr";
import { parseGreCdr, RestGreDespatchAdapter } from "./index";

describe("phase 3 official GRE response handling", () => {
  it("extracts SUNAT QR and document identity only from accepted CDR", () => {
    expect(parseGreCdr(greCdrFixture())).toMatchObject({
      status: "accepted",
      qrUrl: TEST_GRE_QR,
      documentId: "T001-00000001",
      receiverRuc: "20601234567",
    });
    expect(parseGreCdr(greCdrFixture("0", undefined, undefined, "OBSERVACION"))).toMatchObject({
      status: "accepted_with_observation",
    });
    expect(parseGreCdr(greCdrFixture("2324"))).toMatchObject({
      status: "rejected",
      qrUrl: undefined,
    });
  });
  it.each([
    "https://sunat.gob.pe.evil.test/qr",
    "javascript:alert(1)",
    "http://e-factura.sunat.gob.pe/qr",
  ])("rejects untrusted QR URL %s", (qr) => {
    expect(parseGreCdr(greCdrFixture("0", undefined, qr)).qrUrl).toBeUndefined();
  });
  it("rejects malicious XML and corrupt ZIP", () => {
    const z = new AdmZip();
    z.addFile(
      "R.xml",
      Buffer.from('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secrets">]><ApplicationResponse/>'),
    );
    expect(() => parseGreCdr(z.toBuffer())).toThrow();
    expect(() => parseGreCdr(Buffer.from("not ZIP"))).toThrow();
  });
  it.each([
    ["98", "ticket_pending"],
    ["99", "rejected"],
    ["0", "accepted"],
  ])("maps REST2 %s to %s", async (code, status) => {
    const port = new RestGreDespatchAdapter({
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              codRespuesta: code,
              error: { numError: "2345", desError: "Rechazado" },
              indEstado: "0",
            }),
            { status: 200 },
          ),
      ),
    });
    const result = await port.getStatus({ accessToken: "fixture", ticket: "fixture" });
    expect(result.status).toBe(status);
  });
  it("surfaces duplicate 1033 without exposing raw response or retrying", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            errors: [{ codError: "1033", desError: "Registrado previamente" }],
            exc: "private trace",
          }),
          { status: 422 },
        ),
    );
    const port = new RestGreDespatchAdapter({ fetchImpl });
    await expect(
      port.sendDespatch({
        accessToken: "secret",
        zipBytes: Buffer.from("zip"),
        fileName: "fixture.zip",
        ruc: "20601234567",
        documentType: "09",
        serie: "T001",
        number: 1,
      }),
    ).rejects.toMatchObject({ sunatCode: "1033", retryable: false, stage: "transport" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
