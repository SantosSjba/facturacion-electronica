import { describe, expect, it, vi } from "vitest";

import {
  FakeGreDespatchAdapter,
  FakeGreOAuthAdapter,
  GRE_DESPATCH_PORT,
  GRE_OAUTH_PORT,
  PACKAGE_NAME,
  RestGreDespatchAdapter,
  RestGreOAuthAdapter,
  createGreClientsFromEnv,
  packGreZip,
  type GreDespatchPort,
  type GreOAuthPort,
} from "./index";

describe("@factosys/sunat-gre port", () => {
  it("exports package name and DI tokens", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-gre");
    expect(GRE_OAUTH_PORT.description).toBe("GreOAuthPort");
    expect(GRE_DESPATCH_PORT.description).toBe("GreDespatchPort");
  });

  it("adapters implement ports", () => {
    const oauth: GreOAuthPort = new FakeGreOAuthAdapter();
    const despatch: GreDespatchPort = new FakeGreDespatchAdapter();
    expect(typeof oauth.getAccessToken).toBe("function");
    expect(typeof despatch.sendDespatch).toBe("function");
    expect(typeof despatch.getStatus).toBe("function");
  });
});

describe("packGreZip (FE-204)", () => {
  it("names ZIP and hashes content", () => {
    const xml = '<?xml version="1.0"?><DespatchAdvice/>';
    const packed = packGreZip({
      ruc: "20601234567",
      documentType: "09",
      serie: "T001",
      number: 1,
      xml,
    });
    expect(packed.fileStem).toBe("20601234567-09-T001-1");
    expect(packed.fileName).toBe("20601234567-09-T001-1.zip");
    expect(packed.hashZip).toMatch(/^[a-f0-9]{64}$/);
    expect(packed.zipBytes.length).toBeGreaterThan(0);
  });
});

describe("FakeGreOAuthAdapter (FE-202)", () => {
  it("returns deterministic token", async () => {
    const oauth = new FakeGreOAuthAdapter();
    const t = await oauth.getAccessToken({
      clientId: "cid",
      clientSecret: "sec",
      solUser: "20601234567MODDATOS",
      solPassword: "pass",
    });
    expect(t.accessToken).toContain("fake-gre-token");
    expect(t.expiresInSec).toBe(3600);
  });
});

describe("FakeGreDespatchAdapter (FE-204)", () => {
  it("sendDespatch returns ticket and getStatus accepted", async () => {
    const port = new FakeGreDespatchAdapter();
    const packed = packGreZip({
      ruc: "20601234567",
      documentType: "09",
      serie: "T001",
      number: 1,
      xml: "<DespatchAdvice/>",
    });
    const sent = await port.sendDespatch({
      accessToken: "tok",
      zipBytes: packed.zipBytes,
      fileName: packed.fileName,
      ruc: "20601234567",
      documentType: "09",
      serie: "T001",
      number: 1,
    });
    expect(sent.ticket).toMatch(/^fake-gre-ticket-/);
    const status = await port.getStatus({
      accessToken: "tok",
      ticket: sent.ticket,
    });
    expect(status.status).toBe("accepted");
    expect(status.rawCdrZip?.length).toBeGreaterThan(0);
  });
});

describe("RestGreOAuthAdapter", () => {
  it("posts password grant and parses access_token", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(String(init?.body)).toContain("grant_type=password");
      return new Response(
        JSON.stringify({ access_token: "real-token", expires_in: 7200 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const oauth = new RestGreOAuthAdapter({ fetchImpl });
    const t = await oauth.getAccessToken({
      clientId: "cid",
      clientSecret: "sec",
      solUser: "u",
      solPassword: "p",
    });
    expect(t.accessToken).toBe("real-token");
    expect(t.expiresInSec).toBe(7200);
  });
});

describe("RestGreDespatchAdapter", () => {
  it("posts ZIP and extracts numTicket", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL) => {
      return new Response(JSON.stringify({ numTicket: "999888777" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const port = new RestGreDespatchAdapter({ fetchImpl });
    const packed = packGreZip({
      ruc: "20601234567",
      documentType: "09",
      serie: "T001",
      number: 1,
      xml: "<DespatchAdvice/>",
    });
    const result = await port.sendDespatch({
      accessToken: "tok",
      zipBytes: packed.zipBytes,
      fileName: packed.fileName,
      ruc: "20601234567",
      documentType: "09",
      serie: "T001",
      number: 1,
    });
    expect(result.ticket).toBe("999888777");
  });

  it("getStatus maps accepted", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          codRespuesta: "0",
          indEstado: "0",
          descripcion: "Aceptado",
        }),
        { status: 200 },
      );
    });
    const port = new RestGreDespatchAdapter({ fetchImpl });
    const status = await port.getStatus({
      accessToken: "tok",
      ticket: "999",
    });
    expect(status.status).toBe("accepted");
  });
});

describe("createGreClientsFromEnv", () => {
  it("defaults to fake", () => {
    delete process.env.SUNAT_GRE_MODE;
    const clients = createGreClientsFromEnv();
    expect(clients.oauth).toBeInstanceOf(FakeGreOAuthAdapter);
    expect(clients.despatch).toBeInstanceOf(FakeGreDespatchAdapter);
  });
});
