import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";

import { SignupRequestsService } from "../../../infrastructure/saas/signup-requests.service";
import { Public } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createPublicSchema = z.object({
  company_name: z.string().min(1).max(256),
  ruc: z.string().regex(/^\d{11}$/, "RUC must be 11 digits"),
  contact_name: z.string().min(1).max(256),
  contact_email: z.string().email().max(320),
  plan_code: z.string().min(1).max(64).optional(),
  notes: z.string().max(4000).optional(),
  accept_privacy: z.literal(true),
  captcha_token: z.string().min(1).optional(),
});

type CreatePublicBody = z.infer<typeof createPublicSchema>;

@ApiTags("saas-signup-public")
@Controller("saas/public/signup-requests")
export class SignupPublicController {
  constructor(private readonly signup: SignupRequestsService) {}

  @Public()
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Public signup request (landing waitlist)" })
  async create(
    @Body(new ZodValidationPipe(createPublicSchema)) body: CreatePublicBody,
    @Req() req: Request,
  ) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ||
      req.ip ||
      "unknown";
    const email = body.contact_email.trim().toLowerCase();
    const rateLimitKey = `${email}:${ip}`;

    return await this.signup.createPublic({
      companyName: body.company_name.trim(),
      ruc: body.ruc,
      contactName: body.contact_name.trim(),
      contactEmail: email,
      planCode: body.plan_code?.trim(),
      notes: body.notes?.trim(),
      captchaToken: body.captcha_token,
      rateLimitKey,
    });
  }
}
