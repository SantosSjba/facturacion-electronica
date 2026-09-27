import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gte, ilike, lt, lte, or, type SQL } from "drizzle-orm";
import { newId, signupRequests, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { NotificationDispatchService } from "../notifications/notification-dispatch.service";
import { DB } from "../persistence/db.tokens";
import { RateLimitService } from "../redis/rate-limit.service";

export const SIGNUP_STATUSES = [
  "received",
  "under_review",
  "approved",
  "rejected",
] as const;

export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<SignupStatus, readonly SignupStatus[]> = {
  received: ["under_review", "rejected"],
  under_review: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export interface SignupRequestPublic {
  id: string;
  company_name: string;
  ruc: string;
  contact_name: string;
  contact_email: string;
  plan_code: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignupListFilters {
  status?: SignupStatus;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class SignupRequestsService {
  private readonly logger = new Logger(SignupRequestsService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService<Env, true>,
    @Optional() private readonly notifications?: NotificationDispatchService,
  ) {}

  /**
   * Captcha hook (FE-388): when CAPTCHA_SECRET is unset, accept any token.
   * When set, require a non-empty captcha_token (provider wiring comes later).
   */
  assertCaptcha(captchaToken?: string): void {
    const secret = this.config.get("CAPTCHA_SECRET", { infer: true });
    if (!secret) {
      return;
    }
    if (!captchaToken?.trim()) {
      throw AppError.validation("captcha_token is required", [
        { path: "captcha_token", issue: "Required when captcha is enabled" },
      ]);
    }
  }

  async createPublic(input: {
    companyName: string;
    ruc: string;
    contactName: string;
    contactEmail: string;
    planCode?: string;
    notes?: string;
    captchaToken?: string;
    rateLimitKey: string;
  }): Promise<SignupRequestPublic> {
    await this.rateLimit.consumeSignup(input.rateLimitKey);
    this.assertCaptcha(input.captchaToken);

    const id = newId();
    const now = new Date();
    const email = input.contactEmail.trim().toLowerCase();
    await this.db.insert(signupRequests).values({
      id,
      companyName: input.companyName,
      ruc: input.ruc,
      contactName: input.contactName,
      contactEmail: email,
      planCode: input.planCode ?? null,
      notes: input.notes ?? null,
      status: "received",
      createdAt: now,
      updatedAt: now,
    });

    if (this.notifications) {
      try {
        await this.notifications.signupReceived({
          signupId: id,
          companyName: input.companyName,
          ruc: input.ruc,
          contactName: input.contactName,
          contactEmail: email,
        });
      } catch (cause) {
        this.logger.warn(
          `signup notification dispatch failed id=${id}: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      }
    }

    return {
      id,
      company_name: input.companyName,
      ruc: input.ruc,
      contact_name: input.contactName,
      contact_email: email,
      plan_code: input.planCode ?? null,
      status: "received",
      notes: input.notes ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  async list(
    filters: SignupListFilters = {},
  ): Promise<{ items: SignupRequestPublic[]; next_cursor: string | null }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const conditions: SQL[] = [];

    if (filters.status) {
      conditions.push(eq(signupRequests.status, filters.status));
    }
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      conditions.push(
        or(
          ilike(signupRequests.companyName, q),
          ilike(signupRequests.ruc, q),
          ilike(signupRequests.contactEmail, q),
          ilike(signupRequests.contactName, q),
        )!,
      );
    }
    if (filters.dateFrom) {
      const from = parseDateBound(filters.dateFrom, false);
      if (from) conditions.push(gte(signupRequests.createdAt, from));
    }
    if (filters.dateTo) {
      const to = parseDateBound(filters.dateTo, true);
      if (to) conditions.push(lte(signupRequests.createdAt, to));
    }

    if (filters.cursor) {
      const cursorRows = await this.db
        .select({
          id: signupRequests.id,
          createdAt: signupRequests.createdAt,
        })
        .from(signupRequests)
        .where(eq(signupRequests.id, filters.cursor))
        .limit(1);
      const cursorRow = cursorRows[0];
      if (cursorRow) {
        conditions.push(
          or(
            lt(signupRequests.createdAt, cursorRow.createdAt),
            and(
              eq(signupRequests.createdAt, cursorRow.createdAt),
              lt(signupRequests.id, cursorRow.id),
            ),
          )!,
        );
      }
    }

    const rows = await this.db
      .select()
      .from(signupRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(signupRequests.createdAt), desc(signupRequests.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const next =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((r) => this.toPublic(r)),
      next_cursor: next,
    };
  }

  async get(id: string): Promise<SignupRequestPublic> {
    const row = await this.findById(id);
    return this.toPublic(row);
  }

  async patch(
    id: string,
    input: { status?: SignupStatus; notes?: string | null },
  ): Promise<{
    item: SignupRequestPublic;
    previousStatus: string;
    statusChanged: boolean;
    notesUpdated: boolean;
  }> {
    const row = await this.findById(id);
    const previousStatus = row.status;
    let nextStatus = row.status;
    let statusChanged = false;
    let notesUpdated = false;

    if (input.status !== undefined && input.status !== row.status) {
      const from = row.status as SignupStatus;
      const allowed = ALLOWED_TRANSITIONS[from] ?? [];
      if (!allowed.includes(input.status)) {
        throw AppError.conflict(
          `Cannot transition signup request from ${row.status} to ${input.status}`,
        );
      }
      nextStatus = input.status;
      statusChanged = true;
    }

    let nextNotes = row.notes;
    if (input.notes !== undefined) {
      nextNotes = input.notes;
      notesUpdated = input.notes !== row.notes;
    }

    if (!statusChanged && !notesUpdated) {
      return {
        item: this.toPublic(row),
        previousStatus,
        statusChanged: false,
        notesUpdated: false,
      };
    }

    const now = new Date();
    await this.db
      .update(signupRequests)
      .set({
        status: nextStatus,
        notes: nextNotes,
        updatedAt: now,
      })
      .where(eq(signupRequests.id, id));

    return {
      item: this.toPublic({
        ...row,
        status: nextStatus,
        notes: nextNotes,
        updatedAt: now,
      }),
      previousStatus,
      statusChanged,
      notesUpdated,
    };
  }

  private async findById(
    id: string,
  ): Promise<typeof signupRequests.$inferSelect> {
    const rows = await this.db
      .select()
      .from(signupRequests)
      .where(eq(signupRequests.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Signup request not found");
    }
    return row;
  }

  private toPublic(
    row: typeof signupRequests.$inferSelect,
  ): SignupRequestPublic {
    return {
      id: row.id,
      company_name: row.companyName,
      ruc: row.ruc,
      contact_name: row.contactName,
      contact_email: row.contactEmail,
      plan_code: row.planCode,
      status: row.status,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
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
