import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  companies,
  newId,
  orgExports,
  organizations,
  orgPlans,
  plans,
  roles,
  userRoles,
  users,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";
import { QueueProducer } from "../queues/queue.producer";
import { ObjectStorageService } from "../storage/object-storage.service";
import { PLATFORM_ORG_SLUG } from "./orgs.service";

export type OrgExportStatus = "queued" | "processing" | "ready" | "failed";

export interface OrgExportTicketPublic {
  id: string;
  organization_id: string;
  status: OrgExportStatus;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

@Injectable()
export class OrgExportService {
  private readonly logger = new Logger(OrgExportService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly queues: QueueProducer,
    private readonly storage: ObjectStorageService,
  ) {}

  async requestExport(input: {
    organizationId: string;
    requestedByUserId: string;
  }): Promise<OrgExportTicketPublic> {
    const org = await this.requireOrg(input.organizationId);
    if (org.slug === PLATFORM_ORG_SLUG) {
      throw AppError.conflict("Cannot export the platform organization");
    }

    const id = newId();
    await this.db.insert(orgExports).values({
      id,
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      status: "queued",
    });

    await this.queues.enqueue("org-export", {
      organizationId: input.organizationId,
      exportId: id,
    });

    return this.getTicket(input.organizationId, id);
  }

  async getTicket(
    organizationId: string,
    exportId: string,
  ): Promise<OrgExportTicketPublic> {
    const row = await this.findTicket(organizationId, exportId);
    return this.toPublic(row);
  }

  async downloadJson(
    organizationId: string,
    exportId: string,
  ): Promise<{ filename: string; body: Buffer }> {
    const row = await this.findTicket(organizationId, exportId);
    if (row.status !== "ready" || !row.objectKey) {
      throw AppError.conflict(
        row.status === "failed"
          ? `Export failed: ${row.error ?? "unknown"}`
          : "Export is not ready yet",
      );
    }
    const body = await this.storage.getObject(row.objectKey);
    return {
      filename: `org-export-${organizationId.slice(0, 8)}-${exportId.slice(0, 8)}.json`,
      body,
    };
  }

  /** BullMQ worker entry (FE-486). */
  async processExportJob(exportId: string, organizationId: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(orgExports)
      .where(
        and(
          eq(orgExports.id, exportId),
          eq(orgExports.organizationId, organizationId),
        ),
      )
      .limit(1);
    const ticket = rows[0];
    if (!ticket) {
      this.logger.warn(`org-export ticket missing ${exportId}`);
      return;
    }
    if (ticket.status === "ready") return;

    await this.db
      .update(orgExports)
      .set({ status: "processing" })
      .where(eq(orgExports.id, exportId));

    try {
      const snapshot = await this.buildSnapshot(organizationId);
      const key = [
        "org",
        organizationId,
        "exports",
        exportId,
        "snapshot.json",
      ].join("/");
      const body = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8");
      await this.storage.ensureBucket();
      await this.storage.putObject(key, body, "application/json");
      await this.db
        .update(orgExports)
        .set({
          status: "ready",
          objectKey: key,
          error: null,
          completedAt: new Date(),
        })
        .where(eq(orgExports.id, exportId));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : String(cause);
      this.logger.warn(`org-export ${exportId} failed: ${message}`);
      await this.db
        .update(orgExports)
        .set({
          status: "failed",
          error: message.slice(0, 2000),
          completedAt: new Date(),
        })
        .where(eq(orgExports.id, exportId));
      throw cause;
    }
  }

  private async buildSnapshot(organizationId: string) {
    const orgRows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const org = orgRows[0];
    if (!org) throw AppError.notFound("Organization not found");

    const planRows = await this.db
      .select({
        orgPlanId: orgPlans.id,
        planId: plans.id,
        planCode: plans.code,
        planName: plans.name,
        status: orgPlans.status,
      })
      .from(orgPlans)
      .innerJoin(plans, eq(plans.id, orgPlans.planId))
      .where(
        and(
          eq(orgPlans.organizationId, organizationId),
          eq(orgPlans.status, "active"),
        ),
      )
      .limit(1);

    const companyRows = await this.db
      .select({
        id: companies.id,
        ruc: companies.ruc,
        legalName: companies.legalName,
        environment: companies.environment,
        status: companies.status,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .where(eq(companies.organizationId, organizationId));

    const userRows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.organizationId, organizationId));

    const usersOut = [];
    for (const u of userRows) {
      const roleRows = await this.db
        .select({ code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.userId, u.id));
      usersOut.push({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        roles: roleRows.map((r) => r.code),
        created_at: u.createdAt.toISOString(),
      });
    }

    const plan = planRows[0];
    return {
      exported_at: new Date().toISOString(),
      schema_version: 1,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        created_at: org.createdAt.toISOString(),
        updated_at: org.updatedAt.toISOString(),
      },
      current_plan: plan
        ? {
            id: plan.orgPlanId,
            plan_id: plan.planId,
            plan_code: plan.planCode,
            plan_name: plan.planName,
            status: plan.status,
          }
        : null,
      companies: companyRows.map((c) => ({
        id: c.id,
        ruc: c.ruc,
        legal_name: c.legalName,
        environment: c.environment,
        status: c.status,
        created_at: c.createdAt.toISOString(),
      })),
      users: usersOut,
    };
  }

  private async requireOrg(id: string) {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    const org = rows[0];
    if (!org) throw AppError.notFound("Organization not found");
    return org;
  }

  private async findTicket(organizationId: string, exportId: string) {
    const rows = await this.db
      .select()
      .from(orgExports)
      .where(
        and(
          eq(orgExports.id, exportId),
          eq(orgExports.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) throw AppError.notFound("Export not found");
    return row;
  }

  private toPublic(
    row: typeof orgExports.$inferSelect,
  ): OrgExportTicketPublic {
    return {
      id: row.id,
      organization_id: row.organizationId,
      status: row.status as OrgExportStatus,
      error: row.error,
      created_at: row.createdAt.toISOString(),
      completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    };
  }
}
