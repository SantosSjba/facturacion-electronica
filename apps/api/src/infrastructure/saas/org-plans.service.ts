import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { newId, organizations, orgPlans, planChangeRequests, plans, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { NotificationDispatchService } from "../notifications/notification-dispatch.service";
import { InAppNotificationsService } from "../notifications/in-app-notifications.service";
import { DB } from "../persistence/db.tokens";

export type OrgPlanStatus = "trialing" | "active" | "canceled";

export interface OrgPlanPublic {
  id: string;
  organization_id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  resolved_change_request_ids?: string[];
}

@Injectable()
export class OrgPlansService {
  private readonly logger = new Logger(OrgPlansService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Optional() private readonly notifications?: NotificationDispatchService,
    @Optional() private readonly inbox?: InAppNotificationsService,
  ) {}

  async list(filters: {
    organizationId?: string;
    limit?: number;
  }): Promise<{ items: OrgPlanPublic[] }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const rows = filters.organizationId
      ? await this.db
          .select({
            orgPlan: orgPlans,
            planCode: plans.code,
            planName: plans.name,
          })
          .from(orgPlans)
          .innerJoin(plans, eq(plans.id, orgPlans.planId))
          .where(eq(orgPlans.organizationId, filters.organizationId))
          .orderBy(desc(orgPlans.createdAt))
          .limit(limit)
      : await this.db
          .select({
            orgPlan: orgPlans,
            planCode: plans.code,
            planName: plans.name,
          })
          .from(orgPlans)
          .innerJoin(plans, eq(plans.id, orgPlans.planId))
          .orderBy(desc(orgPlans.createdAt))
          .limit(limit);

    return {
      items: rows.map((r) => this.toPublic(r.orgPlan, r.planCode, r.planName)),
    };
  }

  async assign(input: {
    organizationId: string;
    planId: string;
    status?: OrgPlanStatus;
    changeRequestId?: string;
    reviewedByUserId?: string;
    resolutionNote?: string;
  }): Promise<OrgPlanPublic> {
    const status: OrgPlanStatus = input.status ?? "active";
    if (input.changeRequestId && status !== "active")
      throw AppError.validation("Approved requests require an active plan");
    const result = await this.db.transaction(async (tx) => {
      // All plan decisions for an organization serialize on the same row.
      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .for("update");
      if (!org) throw AppError.notFound("Organization not found");
      if (input.changeRequestId) {
        const [change] = await tx
          .select()
          .from(planChangeRequests)
          .where(eq(planChangeRequests.id, input.changeRequestId))
          .for("update");
        if (!change || change.organizationId !== org.id || change.requestedPlanId !== input.planId)
          throw AppError.notFound("Plan change request not found");
        if (change.status === "closed")
          throw AppError.conflict("Plan change request already resolved");
      }
      const [plan] = await tx.select().from(plans).where(eq(plans.id, input.planId)).for("share");
      if (!plan || !plan.isActive) throw AppError.notFound("Requested plan not found or inactive");
      const now = new Date();
      await tx
        .update(orgPlans)
        .set({ status: "canceled", endsAt: now })
        .where(and(eq(orgPlans.organizationId, org.id), ne(orgPlans.status, "canceled")));
      const id = newId();
      await tx
        .insert(orgPlans)
        .values({
          id,
          organizationId: org.id,
          planId: plan.id,
          status,
          startsAt: now,
          endsAt: null,
          createdAt: now,
        });
      const resolved =
        status === "active" || status === "trialing"
          ? await tx
              .update(planChangeRequests)
              .set({
                status: "closed",
                resolution: "approved",
                resolutionNote: input.resolutionNote?.trim() || null,
                resolvedAt: now,
                resolvedByUserId: input.reviewedByUserId ?? null,
                assignedOrgPlanId: id,
                updatedAt: now,
              })
              .where(
                and(
                  eq(planChangeRequests.organizationId, org.id),
                  eq(planChangeRequests.requestedPlanId, plan.id),
                  inArray(planChangeRequests.status, ["pending", "acknowledged"]),
                ),
              )
              .returning()
          : [];
      return { org, plan, now, id, resolved };
    });
    const { org, plan, now, id } = result;
    for (const change of result.resolved) {
      try {
        await this.inbox?.createForUser({
          organizationId: org.id,
          userId: change.requestedByUserId,
          eventCode: "plan.assigned",
          title: "Cambio de plan aprobado",
          body: `Tu solicitud del plan ${plan.name} fue aprobada y el plan ya está activo.${change.resolutionNote ? " " + change.resolutionNote : ""}`,
          payload: { request_id: change.id, resolution: "approved", org_plan_id: id },
        });
      } catch (cause) {
        this.logger.warn(
          `Plan change notification failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }

    if (this.notifications) {
      try {
        await this.notifications.planAssigned({
          orgPlanId: id,
          organizationId: org.id,
          organizationSlug: org.slug ?? "",
          organizationName: org.name,
          planId: plan.id,
          planCode: plan.code,
          planName: plan.name,
          status,
        });
      } catch (cause) {
        this.logger.warn(
          `plan.assigned notification failed orgPlan=${id}: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      }
    }

    return {
      ...this.toPublic(
        {
          id,
          organizationId: input.organizationId,
          planId: input.planId,
          status,
          startsAt: now,
          endsAt: null,
          createdAt: now,
        },
        plan.code,
        plan.name,
      ),
      resolved_change_request_ids: result.resolved.map((change) => change.id),
    };
  }

  private toPublic(
    row: {
      id: string;
      organizationId: string;
      planId: string;
      status: string;
      startsAt: Date;
      endsAt: Date | null;
      createdAt: Date;
    },
    planCode: string,
    planName: string,
  ): OrgPlanPublic {
    return {
      id: row.id,
      organization_id: row.organizationId,
      plan_id: row.planId,
      plan_code: planCode,
      plan_name: planName,
      status: row.status,
      starts_at: row.startsAt.toISOString(),
      ends_at: row.endsAt ? row.endsAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
    };
  }
}
