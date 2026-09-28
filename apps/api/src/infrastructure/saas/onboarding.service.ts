import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  companies,
  legalAcceptances,
  legalDocuments,
  newId,
  organizations,
  signupRequests,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";

const PRIVACY_CODE = "privacy.es-PE";
const TERMS_CODE = "terms.es-PE";

export interface OnboardingStatusPublic {
  complete: boolean;
  has_company: boolean;
  /** True when org already has a company but must accept newer published legal docs. */
  requires_reaccept: boolean;
  organization_id: string;
  organization_name: string;
  organization_slug: string | null;
  legal: {
    privacy: boolean;
    terms: boolean;
  };
  hints: {
    company_name: string | null;
    ruc: string | null;
  } | null;
}

export interface OnboardingLegalDocPublic {
  id: string;
  code: string;
  version: number;
  title: string;
  body_md: string;
  hash: string;
}

@Injectable()
export class OnboardingService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getStatus(organizationId: string): Promise<OnboardingStatusPublic> {
    const orgRows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const org = orgRows[0];
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    const companyRows = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.organizationId, organizationId))
      .limit(1);
    const hasCompany = Boolean(companyRows[0]);

    const published = await this.latestPublished([PRIVACY_CODE, TERMS_CODE]);
    const privacyDoc = published.get(PRIVACY_CODE);
    const termsDoc = published.get(TERMS_CODE);

    const acceptedIds = await this.acceptedDocumentIds(organizationId);
    const privacyOk = privacyDoc ? acceptedIds.has(privacyDoc.id) : false;
    const termsOk = termsDoc ? acceptedIds.has(termsDoc.id) : false;
    const legalOk = privacyOk && termsOk;

    const signupRows = await this.db
      .select({
        companyName: signupRequests.companyName,
        ruc: signupRequests.ruc,
      })
      .from(signupRequests)
      .where(eq(signupRequests.organizationId, organizationId))
      .orderBy(desc(signupRequests.createdAt))
      .limit(1);
    const signup = signupRows[0];

    return {
      complete: hasCompany && legalOk,
      has_company: hasCompany,
      requires_reaccept: hasCompany && !legalOk,
      organization_id: org.id,
      organization_name: org.name,
      organization_slug: org.slug,
      legal: {
        privacy: privacyOk,
        terms: termsOk,
      },
      hints: signup
        ? { company_name: signup.companyName, ruc: signup.ruc }
        : null,
    };
  }

  async listLegalDocuments(): Promise<{ items: OnboardingLegalDocPublic[] }> {
    const published = await this.latestPublished([PRIVACY_CODE, TERMS_CODE]);
    const items: OnboardingLegalDocPublic[] = [];
    for (const code of [PRIVACY_CODE, TERMS_CODE]) {
      const doc = published.get(code);
      if (doc) {
        items.push({
          id: doc.id,
          code: doc.code,
          version: doc.version,
          title: doc.title,
          body_md: doc.bodyMd,
          hash: doc.hash,
        });
      }
    }
    if (items.length < 2) {
      throw AppError.conflict(
        "Published privacy.es-PE and terms.es-PE documents are required",
      );
    }
    return { items };
  }

  async acceptLegal(input: {
    organizationId: string;
    userId: string;
    documentIds: string[];
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<OnboardingStatusPublic> {
    const uniqueIds = [...new Set(input.documentIds)];
    if (uniqueIds.length === 0) {
      throw AppError.validation("document_ids is required", [
        { path: "document_ids", issue: "Required" },
      ]);
    }

    const published = await this.latestPublished([PRIVACY_CODE, TERMS_CODE]);
    const requiredDocs = [...published.values()];
    const requiredIds = requiredDocs.map((d) => d.id);
    if (requiredIds.length < 2) {
      throw AppError.conflict(
        "Published privacy.es-PE and terms.es-PE documents are required",
      );
    }
    const allowed = new Set(requiredIds);
    const docsById = new Map(requiredDocs.map((d) => [d.id, d]));
    for (const id of uniqueIds) {
      if (!allowed.has(id)) {
        throw AppError.validation(
          "Only current published privacy/terms documents can be accepted",
          [{ path: "document_ids", issue: `Invalid id ${id}` }],
        );
      }
    }
    for (const requiredId of requiredIds) {
      if (!uniqueIds.includes(requiredId)) {
        throw AppError.validation(
          "Both current privacy and terms documents must be accepted",
          [{ path: "document_ids", issue: "Missing required document" }],
        );
      }
    }

    const acceptedIds = await this.acceptedDocumentIds(input.organizationId);
    const now = new Date();
    for (const documentId of uniqueIds) {
      if (acceptedIds.has(documentId)) continue;
      const doc = docsById.get(documentId);
      if (!doc) continue;
      await this.db.insert(legalAcceptances).values({
        id: newId(),
        organizationId: input.organizationId,
        userId: input.userId,
        legalDocumentId: documentId,
        acceptedAt: now,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        bodyHash: doc.hash,
      });
    }

    return this.getStatus(input.organizationId);
  }

  private async latestPublished(
    codes: string[],
  ): Promise<Map<string, typeof legalDocuments.$inferSelect>> {
    const rows = await this.db
      .select()
      .from(legalDocuments)
      .where(
        and(
          inArray(legalDocuments.code, codes),
          eq(legalDocuments.status, "published"),
        ),
      )
      .orderBy(desc(legalDocuments.version));

    const map = new Map<string, typeof legalDocuments.$inferSelect>();
    for (const row of rows) {
      if (!map.has(row.code)) {
        map.set(row.code, row);
      }
    }
    return map;
  }

  private async acceptedDocumentIds(
    organizationId: string,
  ): Promise<Set<string>> {
    const rows = await this.db
      .select({ legalDocumentId: legalAcceptances.legalDocumentId })
      .from(legalAcceptances)
      .where(eq(legalAcceptances.organizationId, organizationId));
    return new Set(rows.map((r) => r.legalDocumentId));
  }
}
