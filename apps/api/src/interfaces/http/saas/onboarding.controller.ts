import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { OnboardingService } from "../../../infrastructure/saas/onboarding.service";
import type { UserAuthContext } from "../auth/auth-context";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const acceptLegalSchema = z.object({
  document_ids: z.array(z.string().uuid()).min(1),
});

type AcceptLegalBody = z.infer<typeof acceptLegalSchema>;

@ApiTags("saas-onboarding")
@ApiBearerAuth()
@Controller("saas/onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("status")
  @ApiOperation({ summary: "Org onboarding completion status (S15-ONB)" })
  status(@CurrentAuth() auth: UserAuthContext | { kind: string }) {
    const user = this.assertOrgUser(auth);
    return this.onboarding.getStatus(user.organizationId);
  }

  @Get("legal")
  @ApiOperation({
    summary: "Published privacy + terms for onboarding gate (S15-ONB)",
  })
  legal(@CurrentAuth() auth: UserAuthContext | { kind: string }) {
    this.assertOrgUser(auth);
    return this.onboarding.listLegalDocuments();
  }

  @Post("accept-legal")
  @HttpCode(200)
  @ApiOperation({ summary: "Persist legal acceptances for the org (S15-ONB)" })
  async acceptLegal(
    @CurrentAuth() auth: UserAuthContext | { kind: string },
    @Body(new ZodValidationPipe(acceptLegalSchema)) body: AcceptLegalBody,
    @Req() req: { ip?: string; headers?: Record<string, string | undefined> },
    @Headers("user-agent") userAgent?: string,
  ) {
    const user = this.assertOrgUser(auth);
    return this.onboarding.acceptLegal({
      organizationId: user.organizationId,
      userId: user.userId,
      documentIds: body.document_ids,
      ip: req.ip ?? null,
      userAgent: userAgent ?? null,
    });
  }

  private assertOrgUser(
    auth: UserAuthContext | { kind: string },
  ): UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
    const user = auth as UserAuthContext;
    if (user.ctx !== "org") {
      throw AppError.forbidden("Organization access required");
    }
    return user;
  }
}
