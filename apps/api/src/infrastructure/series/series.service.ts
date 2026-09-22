import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { documentSeries, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { CompaniesService } from "../companies/companies.service";
import { DB } from "../persistence/db.tokens";

export const DOCUMENT_TYPES = [
  "01",
  "03",
  "07",
  "08",
  "09",
  "31",
  "RA",
  "RC",
] as const;

export type DocumentTypeCode = (typeof DOCUMENT_TYPES)[number];

@Injectable()
export class SeriesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
  ) {}

  async list(organizationId: string, companyId: string) {
    await this.companies.requireCompany(organizationId, companyId);
    return this.db
      .select()
      .from(documentSeries)
      .where(
        and(
          eq(documentSeries.organizationId, organizationId),
          eq(documentSeries.companyId, companyId),
        ),
      );
  }

  async create(
    organizationId: string,
    companyId: string,
    input: {
      documentType: DocumentTypeCode;
      serie: string;
      nextNumber?: number;
      padding?: number;
      isActive?: boolean;
    },
  ) {
    await this.companies.requireCompany(organizationId, companyId);
    if (!/^[A-Z0-9]{1,4}$/i.test(input.serie)) {
      throw AppError.validation("Invalid serie", [
        { path: "serie", issue: "must be 1-4 alphanumeric" },
      ]);
    }

    const serie = input.serie.toUpperCase();
    const existing = await this.db
      .select({ id: documentSeries.id })
      .from(documentSeries)
      .where(
        and(
          eq(documentSeries.companyId, companyId),
          eq(documentSeries.documentType, input.documentType),
          eq(documentSeries.serie, serie),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw AppError.conflict("Series already exists");
    }

    const id = newId();
    await this.db.insert(documentSeries).values({
      id,
      organizationId,
      companyId,
      documentType: input.documentType,
      serie,
      nextNumber: input.nextNumber ?? 1,
      padding: input.padding ?? 8,
      isActive: input.isActive ?? true,
    });

    const rows = await this.db
      .select()
      .from(documentSeries)
      .where(eq(documentSeries.id, id))
      .limit(1);
    const created = rows[0];
    if (!created) {
      throw AppError.notFound("Series not found after create");
    }
    return created;
  }

  async patch(
    organizationId: string,
    companyId: string,
    seriesId: string,
    input: { isActive?: boolean; padding?: number },
  ) {
    await this.companies.requireCompany(organizationId, companyId);
    const rows = await this.db
      .select()
      .from(documentSeries)
      .where(
        and(
          eq(documentSeries.id, seriesId),
          eq(documentSeries.companyId, companyId),
          eq(documentSeries.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      throw AppError.notFound("Series not found");
    }

    await this.db
      .update(documentSeries)
      .set({
        isActive: input.isActive ?? rows[0].isActive,
        padding: input.padding ?? rows[0].padding,
        updatedAt: new Date(),
      })
      .where(eq(documentSeries.id, seriesId));

    const updated = await this.db
      .select()
      .from(documentSeries)
      .where(eq(documentSeries.id, seriesId))
      .limit(1);
    const row = updated[0];
    if (!row) {
      throw AppError.notFound("Series not found after update");
    }
    return row;
  }

  /**
   * Atomically allocate next correlative with SELECT … FOR UPDATE.
   */
  async allocateNextNumber(input: {
    organizationId: string;
    companyId: string;
    documentType: string;
    serie: string;
  }): Promise<{ number: number; padded: string; seriesId: string }> {
    const serie = input.serie.toUpperCase();
    return this.db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(documentSeries)
        .where(
          and(
            eq(documentSeries.organizationId, input.organizationId),
            eq(documentSeries.companyId, input.companyId),
            eq(documentSeries.documentType, input.documentType),
            eq(documentSeries.serie, serie),
          ),
        )
        .for("update")
        .limit(1);

      const series = locked[0];
      if (!series) {
        throw AppError.notFound("Series not found");
      }
      if (!series.isActive) {
        throw AppError.conflict("Series is inactive");
      }

      const number = series.nextNumber;
      await tx
        .update(documentSeries)
        .set({ nextNumber: number + 1, updatedAt: new Date() })
        .where(eq(documentSeries.id, series.id));

      return {
        number,
        padded: String(number).padStart(series.padding, "0"),
        seriesId: series.id,
      };
    });
  }

  /**
   * ADR-001 liberate: roll back next_number when allocation was unused (pre-wire failure).
   */
  async liberateNumber(input: {
    organizationId: string;
    companyId: string;
    documentType: string;
    serie: string;
    number: number;
  }): Promise<void> {
    const serie = input.serie.toUpperCase();
    await this.db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(documentSeries)
        .where(
          and(
            eq(documentSeries.organizationId, input.organizationId),
            eq(documentSeries.companyId, input.companyId),
            eq(documentSeries.documentType, input.documentType),
            eq(documentSeries.serie, serie),
          ),
        )
        .for("update")
        .limit(1);
      const series = locked[0];
      if (!series) return;
      // Only rewind if nothing else advanced past our number
      if (series.nextNumber === input.number + 1) {
        await tx
          .update(documentSeries)
          .set({ nextNumber: input.number, updatedAt: new Date() })
          .where(eq(documentSeries.id, series.id));
      }
    });
  }
}
