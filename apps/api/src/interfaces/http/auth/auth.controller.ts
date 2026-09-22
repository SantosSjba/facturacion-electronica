import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AuthService } from "../../../infrastructure/auth/auth.service";
import { Public } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    organization_slug: z.string().min(1).optional(),
    organization_id: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.organization_slug || v.organization_id), {
    message: "organization_slug or organization_id is required",
  });

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

type LoginBody = z.infer<typeof loginSchema>;
type RefreshBody = z.infer<typeof refreshSchema>;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Console login (JWT access + opaque refresh)" })
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginBody) {
    const result = await this.auth.login({
      email: body.email,
      password: body.password,
      organizationSlug: body.organization_slug,
      organizationId: body.organization_id,
    });
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      expires_in: result.expiresIn,
      token_type: "Bearer",
    };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate refresh token and issue new access token" })
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody) {
    const result = await this.auth.refresh(body.refresh_token);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      expires_in: result.expiresIn,
      token_type: "Bearer",
    };
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke refresh token" })
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody): Promise<void> {
    await this.auth.logout(body.refresh_token);
  }
}
