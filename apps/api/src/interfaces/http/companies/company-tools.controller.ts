import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";
import { generateTestPfx, loadPfx } from "@factosys/sunat-sign";
import { X509Certificate } from "node:crypto";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const certificateConvertSchema = z
  .object({
    cert: z.string().min(4).max(180_000),
    cert_pass: z.string().max(512),
    base64: z.boolean().default(true),
  })
  .strict();
export const certificateTestSchema = z.object({ password: z.string().min(8).max(128) }).strict();
export const base64FileSchema = z
  .object({
    base64: z.string().min(4).max(180_000),
    filename: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/)
      .default("file.bin"),
  })
  .strict();

export function decodeBase64(value: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw AppError.validation("Invalid canonical Base64", [], { httpStatus: 422 });
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > 128 * 1024 || bytes.toString("base64") !== value)
    throw AppError.validation("File must contain 1–131072 bytes of canonical Base64", [], {
      httpStatus: 422,
    });
  return bytes;
}

@ApiTags("Utilidades de archivos y certificados")
@ApiBearerAuth()
@ApiKeyAuth()
@Controller("v1/company-tools")
export class CompanyToolsController {
  @Post("certificate")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @RequireScopes("credentials:manage")
  @ApiBody({ schema: z.toJSONSchema(certificateConvertSchema, { io: "input" }) as never })
  @ApiOperation({
    summary: "Convertir P12/PFX enviado a PEM y CER, sin persistir material privado",
  })
  convert(
    @Body(new ZodValidationPipe(certificateConvertSchema, 422))
    body: z.infer<typeof certificateConvertSchema>,
  ) {
    const cert = loadPfx(decodeBase64(body.cert), body.cert_pass);
    const pem = cert.privateKeyPem + cert.certificatePem;
    const cer = new X509Certificate(cert.certificatePem).raw;
    return {
      pem: body.base64 ? Buffer.from(pem).toString("base64") : pem,
      cer: body.base64 ? cer.toString("base64") : cert.certificatePem,
    };
  }

  @Post("certificate/free")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @RequireScopes("credentials:manage")
  @ApiBody({ schema: z.toJSONSchema(certificateTestSchema) as never })
  @ApiOperation({
    summary: "Generar PFX autofirmado de prueba; no acredita identidad ni aceptación SUNAT",
  })
  testCertificate(
    @Body(new ZodValidationPipe(certificateTestSchema, 422))
    body: z.infer<typeof certificateTestSchema>,
  ) {
    return {
      pfx: generateTestPfx(body.password).pfx.toString("base64"),
      test_only: true,
      sunat_acceptance: "not_certified",
    };
  }

  @Post("file/base64")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @RequireScopes("companies:write")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 128 * 1024 } }))
  @ApiOperation({ summary: "Codificar archivo de hasta 128 KiB en Base64" })
  encode(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw AppError.validation("File required", [], { httpStatus: 422 });
    return { base64: file.buffer.toString("base64"), size_bytes: file.buffer.length };
  }

  @Post("base64/file")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @RequireScopes("companies:read")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiBody({ schema: z.toJSONSchema(base64FileSchema, { io: "input" }) as never })
  @ApiOperation({ summary: "Descargar bytes de Base64 sin persistir el archivo" })
  decode(
    @Body(new ZodValidationPipe(base64FileSchema, 422)) body: z.infer<typeof base64FileSchema>,
  ) {
    return new StreamableFile(decodeBase64(body.base64), {
      type: "application/octet-stream",
      disposition: `attachment; filename="${body.filename}"`,
    });
  }
}
