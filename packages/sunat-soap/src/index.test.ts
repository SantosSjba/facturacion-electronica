import AdmZip from "adm-zip";
import { AppErrorCode } from "@factosys/shared";
import { describe, expect, it, vi } from "vitest";

import {
  BILL_SERVICE_PORT,
  FakeBillServiceAdapter,
  PACKAGE_NAME,
  SoapBillServiceAdapter,
  assertCdrAccepted,
  buildCdrZipFixture,
  packInvoiceZip,
  parseCdrZip,
  wsdlUrlToEndpoint,
  type BillServicePort,
} from "./index";

describe("@factosys/sunat-soap port", () => {
  it("exports package name and DI token", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-soap");
    expect(BILL_SERVICE_PORT.description).toBe("BillServicePort");
  });

  it("adapters implement BillServicePort", () => {
    const fake: BillServicePort = new FakeBillServiceAdapter();
    const soap: BillServicePort = new SoapBillServiceAdapter({
      fetchImpl: async () => new Response("", { status: 500 }),
    });
    expect(typeof fake.sendBill).toBe("function");
    expect(typeof soap.sendBill).toBe("function");
  });
});

describe("packInvoiceZip (FE-87)", () => {
  it("names ZIP and packs single XML entry", () => {
    const xml = '<?xml version="1.0"?><Invoice>ok</Invoice>';
    const { zipBytes, fileName, fileStem } = packInvoiceZip({
      ruc: "20601234567",
      documentType: "01",
      serie: "F001",
      number: 1,
      xml,
    });

    expect(fileStem).toBe("20601234567-01-F001-1");
    expect(fileName).toBe("20601234567-01-F001-1.zip");

    const zip = new AdmZip(zipBytes);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.entryName).toBe("20601234567-01-F001-1.xml");
    expect(entries[0]?.getData().toString("utf8")).toBe(xml);
  });
});

describe("parseCdrZip (FE-97)", () => {
  it("classifies accepted / observation / rejected", () => {
    expect(parseCdrZip(buildCdrZipFixture("accepted")).status).toBe("accepted");
    expect(
      parseCdrZip(buildCdrZipFixture("accepted_with_observation")).status,
    ).toBe("accepted_with_observation");
    const rejected = parseCdrZip(buildCdrZipFixture("rejected"));
    expect(rejected.status).toBe("rejected");
    expect(rejected.sunatCode).toBe("2324");
    expect(() => assertCdrAccepted(rejected)).toThrow();
    try {
      assertCdrAccepted(rejected);
    } catch (err) {
      expect(err).toMatchObject({
        code: AppErrorCode.SUNAT_REJECTED,
        stage: "sunat_cdr",
        sunatCode: "2324",
      });
    }
  });
});

describe("FakeBillServiceAdapter (FE-91)", () => {
  it("returns accepted CDR by default", async () => {
    const port = new FakeBillServiceAdapter();
    const packed = packInvoiceZip({
      ruc: "20601234567",
      documentType: "01",
      serie: "F001",
      number: 1,
      xml: "<Invoice/>",
    });
    const result = await port.sendBill({
      zipBytes: packed.zipBytes,
      fileName: packed.fileName,
      solUser: "20601234567MODDATOS",
      solPassword: "unused",
    });
    expect(result.statusCode).toBe("0");
    expect(parseCdrZip(result.rawCdrZip).status).toBe("accepted");
  });

  it("returns rejected CDR when fileName contains REJECT", async () => {
    const port = new FakeBillServiceAdapter();
    const result = await port.sendBill({
      zipBytes: Buffer.from("x"),
      fileName: "REJECT-01-F001-1.zip",
      solUser: "u",
      solPassword: "p",
    });
    expect(result.statusCode).toBe("2324");
    expect(parseCdrZip(result.rawCdrZip).status).toBe("rejected");
  });
});

describe("SoapBillServiceAdapter (FE-93)", () => {
  it("strips ?wsdl from endpoint", () => {
    expect(
      wsdlUrlToEndpoint(
        "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService?wsdl",
      ),
    ).toBe("https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService");
  });

  it("posts UsernameToken envelope and decodes applicationResponse", async () => {
    const cdrZip = buildCdrZipFixture("accepted");
    const cdrB64 = cdrZip.toString("base64");
    const soapResponse = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:sendBillResponse xmlns:ns2="http://service.sunat.gob.pe">
      <applicationResponse>${cdrB64}</applicationResponse>
    </ns2:sendBillResponse>
  </soap:Body>
</soap:Envelope>`;

    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      expect(body).toContain("wsse:UsernameToken");
      expect(body).toContain("<wsse:Username>20601234567MODDATOS</wsse:Username>");
      expect(body).toContain("ser:sendBill");
      expect(body).toContain("<fileName>20601234567-01-F001-1.zip</fileName>");
      expect(body).toContain("<wsse:Password>secret</wsse:Password>");
      return new Response(soapResponse, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    });

    const port = new SoapBillServiceAdapter({ fetchImpl });
    const packed = packInvoiceZip({
      ruc: "20601234567",
      documentType: "01",
      serie: "F001",
      number: 1,
      xml: "<Invoice/>",
    });
    const result = await port.sendBill({
      zipBytes: packed.zipBytes,
      fileName: packed.fileName,
      solUser: "20601234567MODDATOS",
      solPassword: "secret",
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(parseCdrZip(result.rawCdrZip).status).toBe("accepted");
  });

  it("maps SOAP Fault to transport error", async () => {
    const fault = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>Client.AutenticacionIncorrecta</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

    const port = new SoapBillServiceAdapter({
      fetchImpl: async () =>
        new Response(fault, { status: 200, headers: { "Content-Type": "text/xml" } }),
    });

    await expect(
      port.sendBill({
        zipBytes: Buffer.from("x"),
        fileName: "a.zip",
        solUser: "u",
        solPassword: "p",
      }),
    ).rejects.toMatchObject({
      stage: "transport",
      message: "Client.AutenticacionIncorrecta",
    });
  });
});
