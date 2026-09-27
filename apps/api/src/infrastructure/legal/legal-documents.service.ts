import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { legalDocuments, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";

export type LegalDocumentStatus = "draft" | "published";

export interface LegalDocumentPublic {
  id: string;
  code: string;
  version: number;
  title: string;
  body_md: string;
  hash: string;
  status: LegalDocumentStatus;
  published_at: string | null;
  created_at: string;
}

export function contentHash(bodyMd: string): string {
  return createHash("sha256").update(bodyMd, "utf8").digest("hex");
}

@Injectable()
export class LegalDocumentsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(input?: {
    status?: LegalDocumentStatus;
  }): Promise<{ items: LegalDocumentPublic[] }> {
    const rows = input?.status
      ? await this.db
          .select()
          .from(legalDocuments)
          .where(eq(legalDocuments.status, input.status))
          .orderBy(asc(legalDocuments.code), asc(legalDocuments.version))
      : await this.db
          .select()
          .from(legalDocuments)
          .orderBy(asc(legalDocuments.code), asc(legalDocuments.version));

    return { items: rows.map((r) => this.toPublic(r)) };
  }

  async get(id: string): Promise<LegalDocumentPublic> {
    const row = await this.findById(id);
    return this.toPublic(row);
  }

  async create(input: {
    code: string;
    version?: number;
    title: string;
    bodyMd: string;
  }): Promise<LegalDocumentPublic> {
    const code = input.code.trim();
    const version = input.version ?? 1;
    if (!code) {
      throw AppError.validation("code is required");
    }
    if (version < 1) {
      throw AppError.validation("version must be >= 1");
    }

    const existing = await this.db
      .select({ id: legalDocuments.id })
      .from(legalDocuments)
      .where(
        and(eq(legalDocuments.code, code), eq(legalDocuments.version, version)),
      )
      .limit(1);
    if (existing[0]) {
      throw AppError.conflict(
        `Legal document already exists for code=${code} version=${version}`,
      );
    }

    const id = newId();
    const hash = contentHash(input.bodyMd);
    await this.db.insert(legalDocuments).values({
      id,
      code,
      version,
      title: input.title.trim(),
      bodyMd: input.bodyMd,
      hash,
      status: "draft",
    });

    return this.get(id);
  }

  async patch(
    id: string,
    input: {
      title?: string;
      bodyMd?: string;
      version?: number;
    },
  ): Promise<LegalDocumentPublic> {
    const row = await this.findById(id);
    if (row.status !== "draft") {
      throw AppError.conflict("Only draft legal documents can be updated");
    }

    const nextTitle = input.title?.trim() ?? row.title;
    const nextBody = input.bodyMd ?? row.bodyMd;
    const nextVersion = input.version ?? row.version;

    if (nextVersion < 1) {
      throw AppError.validation("version must be >= 1");
    }

    if (nextVersion !== row.version) {
      const clash = await this.db
        .select({ id: legalDocuments.id })
        .from(legalDocuments)
        .where(
          and(
            eq(legalDocuments.code, row.code),
            eq(legalDocuments.version, nextVersion),
          ),
        )
        .limit(1);
      if (clash[0] && clash[0].id !== id) {
        throw AppError.conflict(
          `Legal document already exists for code=${row.code} version=${nextVersion}`,
        );
      }
    }

    await this.db
      .update(legalDocuments)
      .set({
        title: nextTitle,
        bodyMd: nextBody,
        version: nextVersion,
        hash: contentHash(nextBody),
      })
      .where(eq(legalDocuments.id, id));

    return this.get(id);
  }

  private async findById(id: string) {
    const rows = await this.db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Legal document not found");
    }
    return row;
  }

  private toPublic(
    row: typeof legalDocuments.$inferSelect,
  ): LegalDocumentPublic {
    return {
      id: row.id,
      code: row.code,
      version: row.version,
      title: row.title,
      body_md: row.bodyMd,
      hash: row.hash,
      status: row.status as LegalDocumentStatus,
      published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
    };
  }
}
