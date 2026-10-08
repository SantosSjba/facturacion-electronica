import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_LOGO_BYTES, normalizeCompanyLogo } from "./company-logo.service";

describe("company logo validation", () => {
  it.each(["png", "jpeg", "webp"] as const)(
    "decodes %s and stores a PNG with bounded dimensions",
    async (format) => {
      const source = await sharp({
        create: {
          width: 1500,
          height: 750,
          channels: 4,
          background: { r: 20, g: 80, b: 200, alpha: 0.5 },
        },
      })
        .toFormat(format)
        .toBuffer();
      const result = await normalizeCompanyLogo(source);
      expect(result).toMatchObject({ width: 1200, height: 600 });
      const metadata = await sharp(result.body).metadata();
      expect(metadata.format).toBe("png");
      if (format === "png") expect(metadata.hasAlpha).toBe(true);
    },
  );

  it.each([
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'),
    Buffer.from("a file pretending to be a PNG"),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    Buffer.alloc(0),
    Buffer.alloc(MAX_LOGO_BYTES + 1),
  ])("rejects unsupported, corrupt, empty or oversized files", async (source) => {
    await expect(normalizeCompanyLogo(source)).rejects.toMatchObject({ httpStatus: 400 });
  });

  it("rejects a compressed image exceeding the pixel limit", async () => {
    const source = await sharp({
      create: { width: 4100, height: 4100, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    expect(source.length).toBeLessThan(MAX_LOGO_BYTES);
    await expect(normalizeCompanyLogo(source)).rejects.toMatchObject({ httpStatus: 400 });
  });
});
