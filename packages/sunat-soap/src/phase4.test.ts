import { expect, it, vi } from "vitest";
import AdmZip from "adm-zip";
import { SoapCdrConsultAdapter, parseCdrZip, buildApplicationResponseXml } from "./index";
const input = {
  ruc: "20100070970",
  documentType: "01",
  serie: "F001",
  number: 12,
  solUser: "20100070970MODDATOS",
  solPassword: "fixture-only",
};
it("queries the published getStatusCdr operation with WS-Security and immutable identifiers", async () => {
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    return new Response(
      "<Envelope><statusCdr><statusCode>0001</statusCode><content>UEs=</content><statusMessage>fixture</statusMessage></statusCdr></Envelope>",
    );
  });
  const result = await new SoapCdrConsultAdapter({ fetchImpl: fetch }).getStatusCdr(input);
  expect(result.rawCdrZip).toEqual(Buffer.from("PK"));
  expect(fetch.mock.calls[0]?.[0]).toContain("billConsultService");
  const envelope = String(fetch.mock.calls[0]?.[1]?.body);
  for (const value of [
    "getStatusCdr",
    "rucComprobante",
    "tipoComprobante",
    "serieComprobante",
    "numeroComprobante",
    input.solUser,
  ])
    expect(envelope).toContain(value);
  expect(envelope).not.toContain("sendBill");
});
it.each(["03", "09", "31", "RC"])(
  "rejects unsupported identifier recovery %s without network",
  async (documentType) => {
    const fetch = vi.fn();
    await expect(
      new SoapCdrConsultAdapter({ fetchImpl: fetch }).getStatusCdr({ ...input, documentType }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("does not invent a CDR or acceptance from a status-only response", async () => {
  const adapter = new SoapCdrConsultAdapter({
    fetchImpl: async () =>
      new Response(
        "<Envelope><statusCode>0011</statusCode><statusMessage>Not found</statusMessage></Envelope>",
      ),
  });
  expect(await adapter.getStatusCdr(input)).toMatchObject({
    statusCode: "0011",
    rawCdrZip: undefined,
  });
});
it("never leaks fault credentials or raw response body", async () => {
  const adapter = new SoapCdrConsultAdapter({
    fetchImpl: async () =>
      new Response("<Envelope><Fault><faultstring>fixture-secret</faultstring></Fault></Envelope>"),
  });
  await expect(adapter.getStatusCdr(input)).rejects.toThrow("SOAP fault");
});
it("extracts observations and CDR identity and treats CDR 99 as rejection", () => {
  const zip = (xml: string) => {
    const z = new AdmZip();
    z.addFile("R-fixture.xml", Buffer.from(xml));
    return z.toBuffer();
  };
  const observed = parseCdrZip(
    zip(buildApplicationResponseXml("accepted_with_observation", "F001-12")),
  );
  expect(observed).toMatchObject({
    status: "accepted_with_observation",
    sunatCode: "0",
    documentId: "F001-12",
    receiverRuc: "20601234567",
  });
  expect(observed.observations).toHaveLength(1);
  expect(
    parseCdrZip(
      zip(
        buildApplicationResponseXml("accepted").replace(
          ">0</cbc:ResponseCode>",
          ">99</cbc:ResponseCode>",
        ),
      ),
    ).status,
  ).toBe("rejected");
  expect(() =>
    parseCdrZip(zip('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///secret">]><ApplicationResponse/>')),
  ).toThrow();
});
