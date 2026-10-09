import { Body, Controller, Header, HttpCode, Post, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { buildQrImage } from "@factosys/pdf-ri";
import { CompaniesService } from "../../../infrastructure/companies/companies.service";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import type { AuthContext } from "../auth/auth-context";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const saleQrSchema = z
  .object({
    company_id: z.uuid(),
    tipo: z.enum(["01", "03", "07", "08"]),
    serie: z.string().regex(/^[FB][A-Z0-9]{3}$/),
    numero: z
      .string()
      .regex(/^\d{1,8}$/)
      .refine((n) => Number(n) > 0),
    emision: z.iso.date(),
    igv: z.number().nonnegative().multipleOf(0.01),
    total: z.number().nonnegative().multipleOf(0.01),
    clienteTipo: z.string().regex(/^[0-9A-D]$/),
    clienteNumero: z.string().regex(/^[A-Za-z0-9-]{1,20}$/),
  })
  .strict()
  .refine(
    (v) =>
      v.tipo === "01" ? v.serie.startsWith("F") : v.tipo === "03" ? v.serie.startsWith("B") : true,
    { path: ["serie"], message: "Series must match document type" },
  );

@ApiTags("Utilidades de venta")
@ApiBearerAuth()
@ApiKeyAuth()
@Controller("v1/sale")
export class SaleQrController {
  constructor(private readonly companies: CompaniesService) {}
  @Post("qr")
  @HttpCode(200)
  @RequireScopes("documents:read")
  @Header("Cache-Control", "no-store")
  @Header("X-Factosys-QR-Source", "supplied-data")
  @ApiBody({ schema: z.toJSONSchema(saleQrSchema) as never })
  @ApiOperation({
    summary: "Generar PNG QR desde datos suministrados; no verifica emisión ni aceptación",
  })
  async qr(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(saleQrSchema, 422)) body: z.infer<typeof saleQrSchema>,
  ) {
    const company = await this.companies.requireCompany(auth.organizationId, body.company_id);
    const payload = [
      company.ruc,
      body.tipo,
      body.serie,
      body.numero,
      body.igv.toFixed(2),
      body.total.toFixed(2),
      body.emision,
      body.clienteTipo,
      body.clienteNumero,
    ].join("|");
    const qr = await buildQrImage(payload);
    return new StreamableFile(Buffer.from(qr.data_url.split(",")[1] ?? "", "base64"), {
      type: "image/png",
    });
  }
}
