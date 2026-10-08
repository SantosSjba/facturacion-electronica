import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { companies, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";
import { ObjectStorageService } from "../storage/object-storage.service";
import { CompaniesService } from "./companies.service";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Decode and re-encode raster data; never trust the extension or MIME header. */
export async function normalizeCompanyLogo(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_LOGO_BYTES) {
    throw AppError.validation("El logo debe pesar como máximo 2 MB", [
      { path: "file", issue: "size" },
    ]);
  }
  // Reject vector/XML before invoking a decoder that also supports SVG.
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp =
    buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpeg && !webp) {
    throw AppError.validation("Selecciona una imagen PNG, JPG o WebP", [
      { path: "file", issue: "format" },
    ]);
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
      throw new Error("invalid image");
    const { data, info } = await image
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_LOGO_BYTES) throw new Error("normalized image too large");
    return { body: data, width: info.width, height: info.height };
  } catch {
    throw AppError.validation(
      "La imagen no es válida, es animada o excede los límites permitidos",
      [{ path: "file", issue: "invalid image (maximum 16 megapixels, static images only)" }],
    );
  }
}

@Injectable()
export class CompanyLogoService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companiesService: CompaniesService,
    private readonly storage: ObjectStorageService,
  ) {}

  async get(organizationId: string, companyId: string) {
    const company = await this.companiesService.requireCompany(organizationId, companyId);
    if (!company.logo) return { logo: null, data_url: null };
    return {
      logo: this.toPublic(company.logo),
      data_url: await this.getDataUrl(company.logo),
    };
  }

  async put(organizationId: string, companyId: string, buffer: Buffer) {
    await this.companiesService.requireCompany(organizationId, companyId);
    const image = await normalizeCompanyLogo(buffer);
    const logo = {
      objectKey: `${organizationId}/${companyId}/branding/${newId()}.png`,
      contentType: "image/png" as const,
      sizeBytes: image.body.length,
      width: image.width,
      height: image.height,
      sha256: createHash("sha256").update(image.body).digest("hex"),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.putObject(logo.objectKey, image.body, logo.contentType);
    try {
      const updated = await this.db
        .update(companies)
        .set({ logo, updatedAt: new Date() })
        .where(and(eq(companies.organizationId, organizationId), eq(companies.id, companyId)))
        .returning({ id: companies.id });
      if (!updated.length) throw AppError.notFound("Company not found");
    } catch (error) {
      await this.storage.deleteObject(logo.objectKey).catch(() => undefined);
      throw error;
    }
    // Keep immutable versions: an in-flight PDF may still be reading the previous image.
    return {
      logo: this.toPublic(logo),
      data_url: `data:image/png;base64,${image.body.toString("base64")}`,
    };
  }

  async remove(organizationId: string, companyId: string) {
    await this.companiesService.requireCompany(organizationId, companyId);
    await this.db
      .update(companies)
      .set({ logo: null, updatedAt: new Date() })
      .where(and(eq(companies.organizationId, organizationId), eq(companies.id, companyId)));
  }

  async getDataUrl(logo: NonNullable<typeof companies.$inferSelect.logo>): Promise<string> {
    const body = await this.storage.getObject(logo.objectKey);
    return `data:image/png;base64,${body.toString("base64")}`;
  }

  private toPublic(logo: NonNullable<typeof companies.$inferSelect.logo>) {
    return {
      content_type: logo.contentType,
      size_bytes: logo.sizeBytes,
      width: logo.width,
      height: logo.height,
      sha256: logo.sha256,
      updated_at: logo.updatedAt,
    };
  }
}
