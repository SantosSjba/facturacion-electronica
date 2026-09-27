import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuthService } from "../../../infrastructure/auth/auth.service";
import type { UserAuthContext } from "./auth-context";
import { Public } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organization_slug: z.string().min(1).optional(),
  organization_id: z.string().uuid().optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

type LoginBody = z.infer<typeof loginSchema>;
type RefreshBody = z.infer<typeof refreshSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Console login. With email+password only, may return org_selection_required when the account exists in multiple orgs.",
  })
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginBody) {
    const result = await this.auth.login({
      email: body.email,
      password: body.password,
      organizationSlug: body.organization_slug,
      organizationId: body.organization_id,
    });

    if (result.kind === "org_selection") {
      return {
        status: "org_selection_required" as const,
        organizations: result.organizations.map((o) => ({
          id: o.id,
          slug: o.slug,
          name: o.name,
        })),
      };
    }

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
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody,
  ): Promise<void> {
    await this.auth.logout(body.refresh_token);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current console user profile" })
  me(@CurrentAuth() auth: UserAuthContext | { kind: string }) {
    this.assertUser(auth);
    return this.auth.getMe(auth.userId);
  }

  @Post("change-password")
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change password for the current console user" })
  async changePassword(
    @CurrentAuth() auth: UserAuthContext | { kind: string },
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordBody,
  ): Promise<void> {
    this.assertUser(auth);
    await this.auth.changePassword(auth.userId, {
      currentPassword: body.current_password,
      newPassword: body.new_password,
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
