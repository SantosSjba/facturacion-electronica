import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { organizations, planChangeRequests, plans, users, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { OrgPlansService } from "./org-plans.service";
import { InAppNotificationsService } from "../notifications/in-app-notifications.service";

import { DB } from "../persistence/db.tokens";

export type PlanChangeStatus = "pending" | "acknowledged" | "closed";

@Injectable()
export class PlanChangeRequestsService {
  private readonly logger = new Logger(PlanChangeRequestsService.name);
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly orgPlans: OrgPlansService,
    private readonly inbox: InAppNotificationsService,
  ) {}

  async resolve(
    id: string,
    input: { decision: "approve" | "reject"; note?: string; actorId: string },
  ) {
    const [change] = await this.db
      .select()
      .from(planChangeRequests)
      .where(eq(planChangeRequests.id, id));
    if (!change) throw AppError.notFound("Plan change request not found");
    if (input.decision === "approve") {
      const assigned = await this.orgPlans.assign({
        organizationId: change.organizationId,
        planId: change.requestedPlanId,
        changeRequestId: id,
        reviewedByUserId: input.actorId,
        resolutionNote: input.note,
        status: "active",
      });
      return {
        id,
        organization_id: change.organizationId,
        resolution: "approved",
        assigned_plan: assigned,
      };
    }
    const note = input.note?.trim();
    if (!note) throw AppError.validation("A rejection reason is required");
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, change.organizationId))
        .for("update");
      const [locked] = await tx
        .select()
        .from(planChangeRequests)
        .where(eq(planChangeRequests.id, id))
        .for("update");
      if (!locked) throw AppError.notFound("Plan change request not found");
      if (locked.status === "closed")
        throw AppError.conflict("Plan change request already resolved");
      const now = new Date();
      await tx
        .update(planChangeRequests)
        .set({
          status: "closed",
          resolution: "rejected",
          resolutionNote: note,
          resolvedAt: now,
          resolvedByUserId: input.actorId,
          updatedAt: now,
        })
        .where(eq(planChangeRequests.id, id));
    });
    try {
      await this.inbox.createForUser({
        organizationId: change.organizationId,
        userId: change.requestedByUserId,
        eventCode: "system",
        title: "Cambio de plan rechazado",
        body: `Tu solicitud de cambio de plan fue rechazada. Motivo: ${note}`,
        payload: { request_id: id, resolution: "rejected" },
      });
    } catch (cause) {
      this.logger.warn(
        `Plan change notification failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    return { id, organization_id: change.organizationId, resolution: "rejected" };
  }

  async list(filters: {
    status?: PlanChangeStatus;
    organizationId?: string;
    page: number;
    pageSize: number;
  }) {
    const conditions = [];
    if (filters.status) conditions.push(eq(planChangeRequests.status, filters.status));
    if (filters.organizationId)
      conditions.push(eq(planChangeRequests.organizationId, filters.organizationId));
    const where = and(...conditions);
    const totals = await this.db.select({ total: count() }).from(planChangeRequests).where(where);
    const rows = await this.db
      .select({
        request: planChangeRequests,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        requestedPlanCode: plans.code,
        requestedPlanName: plans.name,
        requestedByEmail: users.email,
      })
      .from(planChangeRequests)
      .innerJoin(organizations, eq(organizations.id, planChangeRequests.organizationId))
      .innerJoin(plans, eq(plans.id, planChangeRequests.requestedPlanId))
      .innerJoin(users, eq(users.id, planChangeRequests.requestedByUserId))
      .where(where)
      .orderBy(desc(planChangeRequests.createdAt), desc(planChangeRequests.id))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize);
    const currentIds = rows.flatMap(({ request }) =>
      request.currentPlanId ? [request.currentPlanId] : [],
    );
    const currentPlans = currentIds.length
      ? await this.db
          .select({ id: plans.id, name: plans.name })
          .from(plans)
          .where(inArray(plans.id, currentIds))
      : [];
    const names = new Map(currentPlans.map((plan) => [plan.id, plan.name]));
    return {
      items: rows.map((row) => ({
        id: row.request.id,
        organization_id: row.request.organizationId,
        organization_name: row.organizationName,
        organization_slug: row.organizationSlug,
        requested_by_email: row.requestedByEmail,
        current_plan_name: row.request.currentPlanId
          ? (names.get(row.request.currentPlanId) ?? null)
          : null,
        requested_plan_name: row.requestedPlanName,
        requested_plan_code: row.requestedPlanCode,
        message: row.request.message,
        status: row.request.status,
        resolution: row.request.resolution,
        resolution_note: row.request.resolutionNote,
        resolved_at: row.request.resolvedAt?.toISOString() ?? null,
        created_at: row.request.createdAt.toISOString(),
      })),
      total: totals[0]?.total ?? 0,
      page: filters.page,
      page_size: filters.pageSize,
    };
  }
}
