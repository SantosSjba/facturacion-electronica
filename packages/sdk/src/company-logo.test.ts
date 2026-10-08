import { afterEach, describe, expect, it, vi } from "vitest";
import { FactosysClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("company logo SDK", () => {
  it.each(["https://api.example.com", "https://api.example.com/v1"])(
    "sends multipart binary without a JSON content type from %s",
    async (baseUrl) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ logo: { sha256: "abc" }, data_url: "data:image/png;base64,abc=" }),
            { headers: { "content-type": "application/json" } },
          ),
        );
      vi.stubGlobal("fetch", fetch);
      const client = new FactosysClient({ apiKey: "secret", baseUrl });
      const result = await client.companies.putLogo(
        "company",
        new Blob(["PNG"], { type: "image/png" }),
        "brand.png",
      );
      const call = fetch.mock.calls[0];
      if (!call) throw new Error("No upload request was sent");
      const [url, request] = call;
      expect(url).toBe("https://api.example.com/v1/companies/company/logo");
      expect(request.method).toBe("PUT");
      expect(request.headers.Authorization).toBe("Bearer secret");
      expect(request.headers["Content-Type"]).toBeUndefined();
      expect(request.body).toBeInstanceOf(FormData);
      const file = request.body.get("file") as File;
      expect(file.name).toBe("brand.png");
      expect(await file.text()).toBe("PNG");
      expect(result.data_url).toBe("data:image/png;base64,abc=");
    },
  );

  it("reads and deletes a logo", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ logo: null, data_url: null }), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const client = new FactosysClient({ apiKey: "secret", baseUrl: "https://api.example.com" });
    expect(await client.companies.getLogo("company")).toEqual({ logo: null, data_url: null });
    await expect(client.companies.deleteLogo("company")).resolves.toBeUndefined();
    expect(fetch.mock.calls[1]?.[1].method).toBe("DELETE");
  });
});
