import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { InAppNotificationsService } from "../../../infrastructure/notifications/in-app-notifications.service";
import { OrganizationsMeService } from "../../../infrastructure/saas/organizations-me.service";
import type { UserAuthContext } from "../auth/auth-context";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const planChangeSchema = z.object({
  requested_plan_code: z.string().min(1),
  message: z.string().max(2000).optional(),
});

const prefsPatchSchema = z.object({
  items: z
    .array(
      z.object({
        event_code: z.string().min(1),
        email_enabled: z.boolean().optional(),
        in_app_enabled: z.boolean().optional(),
      }),
    )
    .min(1),
});

type PlanChangeBody = z.infer<typeof planChangeSchema>;
type PrefsPatchBody = z.infer<typeof prefsPatchSchema>;

@ApiTags("organizations-me")
@ApiBearerAuth()
@Controller("organizations/me")
export class OrganizationsMeController {
  constructor(
    private readonly orgsMe: OrganizationsMeService,
    private readonly inbox: InAppNotificationsService,
  ) {}

  @Get("plan")
  @ApiOperation({ summary: "Current org plan + limits vs usage (S15-APP)" })
  getPlan(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.orgsMe.getPlan(auth.organizationId);
  }

  @Get("plan/change-requests")
  @ApiOperation({ summary: "List plan change requests for the org" })
  listChangeRequests(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.orgsMe.listChangeRequests(auth.organizationId);
  }

  @Post("plan/change-requests")
  @ApiOperation({ summary: "Request a plan change (notifies ops)" })
  requestPlanChange(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(planChangeSchema)) body: PlanChangeBody,
  ) {
    this.assertUser(auth);
    return this.orgsMe.requestPlanChange(auth, {
      requestedPlanCode: body.requested_plan_code,
      message: body.message,
    });
  }

  @Get("notifications")
  @ApiOperation({ summary: "In-app notification inbox + unread count" })
  listNotifications(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.inbox.listForUser(auth.userId, auth.organizationId);
  }

  @Post("notifications/read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  markAllRead(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.inbox.markAllRead(auth.userId, auth.organizationId);
  }

  @Post("notifications/:id/read")
  @ApiOperation({ summary: "Mark one notification as read" })
  markRead(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
  ) {
    this.assertUser(auth);
    return this.inbox.markRead(auth.userId, auth.organizationId, id);
  }

  @Get("notification-preferences")
  @ApiOperation({ summary: "Notification channel preferences" })
  listPrefs(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.inbox.listPreferences(auth.userId);
  }

  @Patch("notification-preferences")
  @ApiOperation({ summary: "Update notification preferences" })
  updatePrefs(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(prefsPatchSchema)) body: PrefsPatchBody,
  ) {
    this.assertUser(auth);
    return this.inbox.updatePreferences(
      auth.userId,
      body.items.map((i) => ({
        eventCode: i.event_code,
        emailEnabled: i.email_enabled,
        inAppEnabled: i.in_app_enabled,
      })),
    );
  }

  private assertUser(
    auth: UserAuthContext | { kind: string },
  ): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
