import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, gte, ilike, lt, lte, type SQL } from "drizzle-orm";
import { auditEvents, newId, type Db } from "@factosys/db";

import { DB } from "../persistence/db.tokens";

const SENSITIVE_KEY = /secret|password|token|authorization/i;

export type AuditActorType =
  | "api_key"
  | "system"
  | "worker"
  | "support"
  | "user";

export interface AuditAppendInput {
  organizationId: string;
  companyId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  data?: Record<string, unknown>;
}

export interface AuditListFilters {
  action?: string;
  actor?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditEventDto {
  id: string;
  organization_id: string | null;
  company_id: string | null;
  actor_type: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  data: Record<string, unknown>;
  created_at: Date;
}

export function redactAuditData(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactAuditData(v, depth + 1));
  }
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redactAuditData(v, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Best-effort append — never throws to callers (ops must not fail requests).
   */
  async append(input: AuditAppendInput): Promise<void> {
    try {
      const data = (redactAuditData(input.data ?? {}) ?? {}) as Record<
        string,
        unknown
      >;
      await this.db.insert(auditEvents).values({
        id: newId(),
        organizationId: input.organizationId,
        companyId: input.companyId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        ip: sanitizeIp(input.ip),
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        data,
      });
    } catch (err) {
      this.logger.warn(
        `audit append failed action=${input.action}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async list(
    organizationId: string,
    filters: AuditListFilters = {},
  ): Promise<{ items: AuditEventDto[]; next_cursor: string | null }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const conditions: SQL[] = [
      eq(auditEvents.organizationId, organizationId),
    ];

    if (filters.action?.trim()) {
      conditions.push(eq(auditEvents.action, filters.action.trim()));
    }
    if (filters.actor?.trim()) {
      conditions.push(ilike(auditEvents.actorId, `%${filters.actor.trim()}%`));
    }
    if (filters.dateFrom) {
      const from = parseDateBound(filters.dateFrom, false);
      if (from) conditions.push(gte(auditEvents.createdAt, from));
    }
    if (filters.dateTo) {
      const to = parseDateBound(filters.dateTo, true);
      if (to) conditions.push(lte(auditEvents.createdAt, to));
    }
    if (filters.cursor) {
      const cursorDate = new Date(filters.cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        conditions.push(lt(auditEvents.createdAt, cursorDate));
      }
    }

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = page[page.length - 1];
    const next_cursor =
      hasMore && last ? last.createdAt.toISOString() : null;

    return {
      items: page.map((r) => ({
        id: r.id,
        organization_id: r.organizationId,
        company_id: r.companyId,
        actor_type: r.actorType,
        actor_id: r.actorId,
        action: r.action,
        resource_type: r.resourceType,
        resource_id: r.resourceId,
        ip: r.ip,
        user_agent: r.userAgent,
        data: (redactAuditData(r.data ?? {}) ?? {}) as Record<string, unknown>,
        created_at: r.createdAt,
      })),
      next_cursor,
    };
  }
}

function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip?.trim()) return null;
  const v = ip.trim().split(",")[0]?.trim() ?? "";
  // basic IPv4 / IPv6 shape; invalid values would break inet column
  if (
    !/^(\d{1,3}\.){3}\d{1,3}$/.test(v) &&
    !/^[0-9a-fA-F:]+$/.test(v)
  ) {
    return null;
  }
  return v.slice(0, 64);
}

function parseDateBound(raw: string, endOfDay: boolean): Date | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) {
      d.setUTCHours(23, 59, 59, 999);
    } else {
      d.setUTCHours(0, 0, 0, 0);
    }
  }
  return d;
}
