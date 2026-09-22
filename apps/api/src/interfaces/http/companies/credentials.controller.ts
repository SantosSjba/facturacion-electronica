import {
  Body,
  Controller,
  HttpCode,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { CredentialsService } from "../../../infrastructure/credentials/credentials.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const solSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const greSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

type SolBody = z.infer<typeof solSchema>;
type GreBody = z.infer<typeof greSchema>;

@ApiTags("credentials")
@ApiBearerAuth()
@Controller("companies/:companyId")
export class CredentialsController {
  constructor(private readonly credentials: CredentialsService) {}

  @Put("certificate")
  @HttpCode(204)
  @RequirePermissions("credentials:manage")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload encrypted PFX certificate" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  async putCertificate(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("password") password: string | undefined,
  ): Promise<void> {
    this.assertUser(auth);
    if (!file?.buffer?.length) {
      throw AppError.validation("PFX file is required", [
        { path: "file", issue: "missing" },
      ]);
    }
    if (!password) {
      throw AppError.validation("password is required", [
        { path: "password", issue: "missing" },
      ]);
    }
    await this.credentials.putCertificate(
      auth.organizationId,
      companyId,
      file.buffer,
      password,
    );
  }

  @Put("sol-credentials")
  @HttpCode(204)
  @RequirePermissions("credentials:manage")
  @ApiOperation({ summary: "Store encrypted SOL credentials" })
  async putSol(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(solSchema)) body: SolBody,
  ): Promise<void> {
    this.assertUser(auth);
    await this.credentials.putSol(auth.organizationId, companyId, {
      username: body.username,
      password: body.password,
    });
  }

  @Put("gre-credentials")
  @HttpCode(204)
  @RequirePermissions("credentials:manage")
  @ApiOperation({ summary: "Store encrypted GRE client credentials" })
  async putGre(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(greSchema)) body: GreBody,
  ): Promise<void> {
    this.assertUser(auth);
    await this.credentials.putGre(auth.organizationId, companyId, {
      clientId: body.client_id,
      clientSecret: body.client_secret,
    });
  }

  private assertUser(
    auth: UserAuthContext | { kind: string },
  ): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
