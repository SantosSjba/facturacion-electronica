import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import {
  apiKeys,
  companies,
  documents,
  newId,
  organizations,
  orgPlans,
  planChangeRequests,
  plans,
  users,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { NotificationDispatchService } from "../notifications/notification-dispatch.service";
import { InAppNotificationsService } from "../notifications/in-app-notifications.service";
import { DB } from "../persistence/db.tokens";
import type { UserAuthContext } from "../../interfaces/http/auth/auth-context";

export interface OrgPlanUsagePublic {
  companies: number;
  users: number;
  api_keys: number;
  documents_this_month: number;
}

export interface OrgPlanMePublic {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  org_plan_id: string | null;
  org_plan_status: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_display: string;
    currency: string;
  } | null;
  limits: {
    max_companies: number;
    max_users: number;
    max_documents_per_month: number;
    max_api_keys: number;
  } | null;
  usage: OrgPlanUsagePublic;
}

export interface PlanChangeRequestPublic {
  id: string;
  status: string;
  message: string | null;
  current_plan_id: string | null;
  current_plan_code: string | null;
  requested_plan_id: string;
  requested_plan_code: string;
  requested_plan_name: string;
  requested_by_user_id: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class OrganizationsMeService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notifications: NotificationDispatchService,
    private readonly inApp: InAppNotificationsService,
  ) {}

  async getPlan(organizationId: string): Promise<OrgPlanMePublic> {
    const orgRows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const org = orgRows[0];
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    const planRows = await this.db
      .select({
        orgPlan: orgPlans,
        plan: plans,
      })
      .from(orgPlans)
      .innerJoin(plans, eq(plans.id, orgPlans.planId))
      .where(
        and(
          eq(orgPlans.organizationId, organizationId),
          inArray(orgPlans.status, ["active", "trialing"]),
        ),
      )
      .orderBy(desc(orgPlans.createdAt))
      .limit(1);

    const current = planRows[0];
    const usage = await this.computeUsage(organizationId);

    if (!current) {
      return {
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug ?? "",
        org_plan_id: null,
        org_plan_status: null,
        plan: null,
        limits: null,
        usage,
      };
    }

    return {
      organization_id: org.id,
      organization_name: org.name,
      organization_slug: org.slug ?? "",
      org_plan_id: current.orgPlan.id,
      org_plan_status: current.orgPlan.status,
      plan: {
        id: current.plan.id,
        code: current.plan.code,
        name: current.plan.name,
        description: current.plan.description,
        price_display: current.plan.priceDisplay,
        currency: current.plan.currency,
      },
      limits: {
        max_companies: current.plan.maxCompanies,
        max_users: current.plan.maxUsers,
        max_documents_per_month: current.plan.maxDocumentsPerMonth,
        max_api_keys: current.plan.maxApiKeys,
      },
      usage,
    };
  }

  async listChangeRequests(
    organizationId: string,
  ): Promise<{ items: PlanChangeRequestPublic[] }> {
    const rows = await this.db
      .select({
        req: planChangeRequests,
        requestedCode: plans.code,
        requestedName: plans.name,
      })
      .from(planChangeRequests)
      .innerJoin(plans, eq(plans.id, planChangeRequests.requestedPlanId))
      .where(eq(planChangeRequests.organizationId, organizationId))
      .orderBy(desc(planChangeRequests.createdAt))
      .limit(50);

    const currentPlanIds = [
      ...new Set(
        rows
          .map((r) => r.req.currentPlanId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const currentPlanMap = new Map<string, string>();
    if (currentPlanIds.length) {
      const currentPlans = await this.db
        .select({ id: plans.id, code: plans.code })
        .from(plans)
        .where(inArray(plans.id, currentPlanIds));
      for (const p of currentPlans) {
        currentPlanMap.set(p.id, p.code);
      }
    }

    return {
      items: rows.map((r) => ({
        id: r.req.id,
        status: r.req.status,
        message: r.req.message,
        current_plan_id: r.req.currentPlanId,
        current_plan_code: r.req.currentPlanId
          ? (currentPlanMap.get(r.req.currentPlanId) ?? null)
          : null,
        requested_plan_id: r.req.requestedPlanId,
        requested_plan_code: r.requestedCode,
        requested_plan_name: r.requestedName,
        requested_by_user_id: r.req.requestedByUserId,
        created_at: r.req.createdAt.toISOString(),
        updated_at: r.req.updatedAt.toISOString(),
      })),
    };
  }

  async requestPlanChange(
    actor: UserAuthContext,
    input: { requestedPlanCode: string; message?: string },
  ): Promise<PlanChangeRequestPublic> {
    const me = await this.getPlan(actor.organizationId);
    const requestedRows = await this.db
      .select()
      .from(plans)
      .where(
        and(eq(plans.code, input.requestedPlanCode), eq(plans.isActive, true)),
      )
      .limit(1);
    const requested = requestedRows[0];
    if (!requested) {
      throw AppError.notFound("Requested plan not found or inactive");
    }

    if (me.plan?.id === requested.id) {
      throw AppError.validation("Requested plan is already the current plan");
    }

    const pending = await this.db
      .select({ id: planChangeRequests.id })
      .from(planChangeRequests)
      .where(
        and(
          eq(planChangeRequests.organizationId, actor.organizationId),
          eq(planChangeRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (pending[0]) {
      throw AppError.conflict("A pending plan change request already exists");
    }

    const id = newId();
    const now = new Date();
    await this.db.insert(planChangeRequests).values({
      id,
      organizationId: actor.organizationId,
      requestedByUserId: actor.userId,
      currentPlanId: me.plan?.id ?? null,
      requestedPlanId: requested.id,
      message: input.message?.trim() || null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await this.notifications.planChangeRequested({
      requestId: id,
      organizationId: actor.organizationId,
      organizationSlug: me.organization_slug,
      organizationName: me.organization_name,
      currentPlanCode: me.plan?.code ?? null,
      currentPlanName: me.plan?.name ?? null,
      requestedPlanCode: requested.code,
      requestedPlanName: requested.name,
      message: input.message?.trim() || null,
      requestedByEmail: actor.email,
    });

    await this.inApp.createForUser({
      organizationId: actor.organizationId,
      userId: actor.userId,
      eventCode: "plan.change_requested",
      title: "Solicitud de cambio de plan enviada",
      body: `Solicitaste el plan ${requested.name} (${requested.code}). El equipo de Factosys la revisará.`,
      payload: {
        request_id: id,
        requested_plan_code: requested.code,
      },
    });

    const listed = await this.listChangeRequests(actor.organizationId);
    const created = listed.items.find((i) => i.id === id);
    if (!created) {
      throw AppError.internal("Failed to load created plan change request");
    }
    return created;
  }

  private async computeUsage(
    organizationId: string,
  ): Promise<OrgPlanUsagePublic> {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [companiesCount, usersCount, apiKeysCount, docsCount] =
      await Promise.all([
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(companies)
          .where(eq(companies.organizationId, organizationId)),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.organizationId, organizationId)),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(apiKeys)
          .where(
            and(
              eq(apiKeys.organizationId, organizationId),
              ne(apiKeys.status, "revoked"),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(documents)
          .where(
            and(
              eq(documents.organizationId, organizationId),
              gte(documents.createdAt, monthStart),
              lt(documents.createdAt, nextMonth),
            ),
          ),
      ]);

    return {
      companies: Number(companiesCount[0]?.count ?? 0),
      users: Number(usersCount[0]?.count ?? 0),
      api_keys: Number(apiKeysCount[0]?.count ?? 0),
      documents_this_month: Number(docsCount[0]?.count ?? 0),
    };
  }
}
