import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { and, desc, eq, ne } from "drizzle-orm";
import {
  newId,
  organizations,
  orgPlans,
  plans,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { NotificationDispatchService } from "../notifications/notification-dispatch.service";
import { DB } from "../persistence/db.tokens";
import { PlansService } from "./plans.service";

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
}

@Injectable()
export class OrgPlansService {
  private readonly logger = new Logger(OrgPlansService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly plansService: PlansService,
    @Optional() private readonly notifications?: NotificationDispatchService,
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
      items: rows.map((r) =>
        this.toPublic(r.orgPlan, r.planCode, r.planName),
      ),
    };
  }

  async assign(input: {
    organizationId: string;
    planId: string;
    status?: OrgPlanStatus;
  }): Promise<OrgPlanPublic> {
    const orgRows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1);
    const org = orgRows[0];
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    const plan = await this.plansService.requireActivePlan(input.planId);
    const status: OrgPlanStatus = input.status ?? "active";
    const now = new Date();

    await this.db
      .update(orgPlans)
      .set({
        status: "canceled",
        endsAt: now,
      })
      .where(
        and(
          eq(orgPlans.organizationId, input.organizationId),
          ne(orgPlans.status, "canceled"),
        ),
      );

    const id = newId();
    await this.db.insert(orgPlans).values({
      id,
      organizationId: input.organizationId,
      planId: input.planId,
      status,
      startsAt: now,
      endsAt: null,
      createdAt: now,
    });

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

    return this.toPublic(
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
    );
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
