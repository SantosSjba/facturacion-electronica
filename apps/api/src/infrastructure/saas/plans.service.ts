import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, ne } from "drizzle-orm";
import { newId, plans, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";

export interface PlanPublic {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_display: string;
  currency: string;
  active: boolean;
  max_companies: number;
  max_users: number;
  max_documents_per_month: number;
  max_api_keys: number;
  created_at: string;
  updated_at: string;
}

export interface PlanWriteInput {
  code: string;
  name: string;
  description?: string | null;
  priceMonthlyCents: number;
  priceDisplay: string;
  currency: string;
  maxCompanies: number;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  maxApiKeys: number;
  active?: boolean;
}

@Injectable()
export class PlansService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listActive(): Promise<{ items: PlanPublic[] }> {
    const rows = await this.db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.priceMonthlyCents), asc(plans.code));
    return { items: rows.map((r) => this.toPublic(r)) };
  }

  async getPublic(id: string): Promise<PlanPublic> {
    const row = await this.findById(id);
    if (!row.isActive) {
      throw AppError.notFound("Plan not found");
    }
    return this.toPublic(row);
  }

  async get(id: string): Promise<PlanPublic> {
    const row = await this.findById(id);
    return this.toPublic(row);
  }

  async create(input: PlanWriteInput): Promise<PlanPublic> {
    const code = input.code.trim().toLowerCase();
    if (!code) {
      throw AppError.validation("code is required");
    }
    this.assertLimits(input);

    const existing = await this.db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.code, code))
      .limit(1);
    if (existing[0]) {
      throw AppError.conflict(`Plan already exists for code=${code}`);
    }

    const id = newId();
    const now = new Date();
    await this.db.insert(plans).values({
      id,
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceMonthlyCents: input.priceMonthlyCents,
      priceDisplay: input.priceDisplay.trim(),
      currency: input.currency.trim().toUpperCase(),
      isActive: input.active ?? true,
      maxCompanies: input.maxCompanies,
      maxUsers: input.maxUsers,
      maxDocumentsPerMonth: input.maxDocumentsPerMonth,
      maxApiKeys: input.maxApiKeys,
      createdAt: now,
      updatedAt: now,
    });

    return this.get(id);
  }

  async patch(
    id: string,
    input: Partial<PlanWriteInput>,
  ): Promise<PlanPublic> {
    const row = await this.findById(id);
    const next = {
      code: input.code !== undefined ? input.code.trim().toLowerCase() : row.code,
      name: input.name !== undefined ? input.name.trim() : row.name,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : row.description,
      priceMonthlyCents:
        input.priceMonthlyCents !== undefined
          ? input.priceMonthlyCents
          : row.priceMonthlyCents,
      priceDisplay:
        input.priceDisplay !== undefined
          ? input.priceDisplay.trim()
          : row.priceDisplay,
      currency:
        input.currency !== undefined
          ? input.currency.trim().toUpperCase()
          : row.currency,
      maxCompanies:
        input.maxCompanies !== undefined
          ? input.maxCompanies
          : row.maxCompanies,
      maxUsers: input.maxUsers !== undefined ? input.maxUsers : row.maxUsers,
      maxDocumentsPerMonth:
        input.maxDocumentsPerMonth !== undefined
          ? input.maxDocumentsPerMonth
          : row.maxDocumentsPerMonth,
      maxApiKeys:
        input.maxApiKeys !== undefined ? input.maxApiKeys : row.maxApiKeys,
      active: input.active !== undefined ? input.active : row.isActive,
    };
    this.assertLimits(next);

    if (next.code !== row.code) {
      const clash = await this.db
        .select({ id: plans.id })
        .from(plans)
        .where(and(eq(plans.code, next.code), ne(plans.id, id)))
        .limit(1);
      if (clash[0]) {
        throw AppError.conflict(`Plan already exists for code=${next.code}`);
      }
    }

    await this.db
      .update(plans)
      .set({
        code: next.code,
        name: next.name,
        description: next.description,
        priceMonthlyCents: next.priceMonthlyCents,
        priceDisplay: next.priceDisplay,
        currency: next.currency,
        isActive: next.active,
        maxCompanies: next.maxCompanies,
        maxUsers: next.maxUsers,
        maxDocumentsPerMonth: next.maxDocumentsPerMonth,
        maxApiKeys: next.maxApiKeys,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id));

    return this.get(id);
  }

  /** Soft-retire: always set is_active=false (never hard-delete). */
  async retire(id: string): Promise<PlanPublic> {
    await this.findById(id);
    await this.db
      .update(plans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(plans.id, id));
    return this.get(id);
  }

  async requireActivePlan(id: string): Promise<typeof plans.$inferSelect> {
    const row = await this.findById(id);
    if (!row.isActive) {
      throw AppError.conflict("Plan is not active");
    }
    return row;
  }

  private assertLimits(input: {
    maxCompanies: number;
    maxUsers: number;
    maxDocumentsPerMonth: number;
    maxApiKeys: number;
    currency: string;
    priceMonthlyCents: number;
  }): void {
    if (input.priceMonthlyCents < 0) {
      throw AppError.validation("price_monthly_cents must be >= 0");
    }
    if (input.currency.length !== 3) {
      throw AppError.validation("currency must be 3 letters");
    }
    for (const [key, value] of [
      ["max_companies", input.maxCompanies],
      ["max_users", input.maxUsers],
      ["max_documents_per_month", input.maxDocumentsPerMonth],
      ["max_api_keys", input.maxApiKeys],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        throw AppError.validation(`${key} must be an integer >= 0`);
      }
    }
  }

  private async findById(id: string): Promise<typeof plans.$inferSelect> {
    const rows = await this.db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Plan not found");
    }
    return row;
  }

  private toPublic(row: typeof plans.$inferSelect): PlanPublic {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      price_monthly_cents: row.priceMonthlyCents,
      price_display: row.priceDisplay,
      currency: row.currency,
      active: row.isActive,
      max_companies: row.maxCompanies,
      max_users: row.maxUsers,
      max_documents_per_month: row.maxDocumentsPerMonth,
      max_api_keys: row.maxApiKeys,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
