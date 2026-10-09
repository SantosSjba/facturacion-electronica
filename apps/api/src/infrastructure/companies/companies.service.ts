import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, ne } from "drizzle-orm";
import { isValidRuc } from "@factosys/domain";
import {
  companies,
  credentials,
  documentSeries,
  documents,
  webhookEndpoints,
  newId,
  organizations,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";
import { withPlanCapacity } from "../saas/plan-capacity";

import type { PdfFormat } from "@factosys/pdf-ri";

export type CompanyEnvironment = "sandbox" | "production";
export type CompanyStatus = "active" | "disabled";

/** Starter series for onboarding (RA/RC use YYYYMMDD and are created on demand). */
export const DEFAULT_COMPANY_SERIES = [
  { documentType: "01", serie: "F001" },
  { documentType: "03", serie: "B001" },
  { documentType: "07", serie: "FC01" },
  { documentType: "08", serie: "FD01" },
  { documentType: "09", serie: "T001" },
  { documentType: "31", serie: "V001" },
] as const;

export interface CompanyPublic {
  id: string;
  organization_id: string;
  ruc: string;
  legal_name: string;
  trade_name: string | null;
  logo: null | {
    content_type: string;
    size_bytes: number;
    width: number;
    height: number;
    sha256: string;
    updated_at: string;
  };
  environment: string;
  status: CompanyStatus;
  address: unknown;
  catalog_pin: Record<string, string>;
  timezone: string;
  pdf_format: PdfFormat;
  tax_agent_settings: { retention: boolean; perception_regimes: ("01" | "02" | "03")[] };
  created_at: Date;
  updated_at: Date;
  certificate_status: "missing" | "active" | "expired" | "revoked";
  sol_configured: boolean;
  gre_configured: boolean;
  credentials_summary: {
    certificate: null | {
      status: string;
      subject_cn: string | null;
      not_before: string | null;
      not_after: string | null;
      rotated_at: string | null;
    };
    sol: null | {
      configured: true;
      username: string | null;
      rotated_at: string | null;
    };
    gre: null | {
      configured: true;
      client_id: string | null;
      rotated_at: string | null;
    };
  };
}

@Injectable()
export class CompaniesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async remove(organizationId: string, companyId: string, permanent = false): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
        .for("update");
      if (!company) throw AppError.notFound("Company not found");
      if (!permanent) {
        await tx
          .update(companies)
          .set({ status: "disabled", updatedAt: new Date() })
          .where(eq(companies.id, companyId));
        return;
      }
      const [document] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.companyId, companyId))
        .limit(1);
      if (document) throw AppError.conflict("Company has fiscal history; use logical deletion");
      const [webhook] = await tx
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.companyId, companyId))
        .limit(1);
      if (webhook)
        throw AppError.conflict("Remove company webhook endpoints before permanent deletion");
      await tx
        .delete(companies)
        .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)));
    });
  }

  async create(
    organizationId: string,
    input: {
      ruc: string;
      legalName: string;
      tradeName?: string | null;
      environment: CompanyEnvironment;
      address?: Record<string, unknown> | null;
      timezone?: string;
      pdfFormat?: PdfFormat;
      taxAgentSettings?: CompanyPublic["tax_agent_settings"];
      seedDefaultSeries?: boolean;
    },
  ): Promise<CompanyPublic> {
    if (!isValidRuc(input.ruc)) {
      throw AppError.validation("Invalid RUC", [
        { path: "ruc", issue: "checksum or length invalid" },
      ]);
    }

    const id = newId();
    await withPlanCapacity(this.db, organizationId, "companies", async (tx) => {
      const existing = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.organizationId, organizationId),
            eq(companies.ruc, input.ruc),
            eq(companies.environment, input.environment),
          ),
        )
        .limit(1);
      if (existing[0]) {
        throw AppError.conflict("Company already exists for this RUC and environment");
      }

      await tx.insert(companies).values({
        id,
        organizationId,
        ruc: input.ruc,
        legalName: input.legalName,
        tradeName: input.tradeName ?? null,
        environment: input.environment,
        address: input.address ?? null,
        timezone: input.timezone ?? "America/Lima",
        pdfFormat: input.pdfFormat ?? "A4",
        taxAgentSettings: input.taxAgentSettings,
        status: "active",
      });

      if (input.seedDefaultSeries !== false) {
        await tx.insert(documentSeries).values(
          DEFAULT_COMPANY_SERIES.map((s) => ({
            id: newId(),
            organizationId,
            companyId: id,
            documentType: s.documentType,
            serie: s.serie,
            nextNumber: 1,
            padding: 8,
            isActive: true,
          })),
        );
      }
    });

    return this.get(organizationId, id);
  }

  async list(organizationId: string): Promise<CompanyPublic[]> {
    const rows = await this.db
      .select()
      .from(companies)
      .where(eq(companies.organizationId, organizationId))
      .orderBy(desc(companies.createdAt), desc(companies.id));
    const result: CompanyPublic[] = [];
    for (const row of rows) {
      result.push(await this.toPublic(row));
    }
    return result;
  }

  async get(organizationId: string, companyId: string): Promise<CompanyPublic> {
    const row = await this.requireCompany(organizationId, companyId);
    return this.toPublic(row);
  }

  async patch(
    organizationId: string,
    companyId: string,
    input: {
      environment?: CompanyEnvironment;
      legalName?: string;
      tradeName?: string | null;
      address?: Record<string, unknown> | null;
      timezone?: string;
      pdfFormat?: PdfFormat;
      taxAgentSettings?: CompanyPublic["tax_agent_settings"];
      status?: CompanyStatus;
    },
  ): Promise<CompanyPublic> {
    await this.requireCompany(organizationId, companyId);
    const patch: {
      environment?: CompanyEnvironment;
      legalName?: string;
      tradeName?: string | null;
      address?: Record<string, unknown> | null;
      timezone?: string;
      pdfFormat?: PdfFormat;
      taxAgentSettings?: CompanyPublic["tax_agent_settings"];
      status?: CompanyStatus;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (input.legalName !== undefined) patch.legalName = input.legalName;
    if (input.tradeName !== undefined) patch.tradeName = input.tradeName;
    if (input.address !== undefined) patch.address = input.address;
    if (input.taxAgentSettings !== undefined) patch.taxAgentSettings = input.taxAgentSettings;
    if (input.pdfFormat !== undefined) patch.pdfFormat = input.pdfFormat;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.status !== undefined) patch.status = input.status;
    if (input.environment !== undefined) patch.environment = input.environment;

    await this.db.transaction(async (tx) => {
      // Serialize with creation and other switches to prevent a duplicate RUC/ambiente.
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .for("update");
      const [current] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
        .for("update");
      if (!current) throw AppError.notFound("Company not found");
      if (input.environment !== undefined && input.environment !== current.environment) {
        const [existing] = await tx
          .select({ id: companies.id })
          .from(companies)
          .where(
            and(
              eq(companies.organizationId, organizationId),
              eq(companies.ruc, current.ruc),
              eq(companies.environment, input.environment),
              ne(companies.id, companyId),
            ),
          )
          .limit(1);
        if (existing)
          throw AppError.conflict("Company already exists for this RUC and environment");
      }
      await tx.update(companies).set(patch).where(eq(companies.id, companyId));
    });
    return this.get(organizationId, companyId);
  }

  async requireCompany(organizationId: string, companyId: string) {
    const rows = await this.db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Company not found");
    }
    return row;
  }

  /** Like requireCompany but blocks emission when the company is disabled. */
  async requireActiveCompany(organizationId: string, companyId: string) {
    const row = await this.requireCompany(organizationId, companyId);
    if (row.status === "disabled") {
      throw AppError.validation("Empresa deshabilitada", [
        { path: "company_id", issue: "company is disabled" },
      ]);
    }
    return row;
  }

  private async toPublic(row: typeof companies.$inferSelect): Promise<CompanyPublic> {
    const creds = await this.db
      .select({
        kind: credentials.kind,
        status: credentials.status,
        publicMetadata: credentials.publicMetadata,
        rotatedAt: credentials.rotatedAt,
      })
      .from(credentials)
      .where(eq(credentials.companyId, row.id));

    const cert = creds.find((c) => c.kind === "certificate");
    let certificate_status: CompanyPublic["certificate_status"] = "missing";
    if (cert) {
      if (cert.status === "active" || cert.status === "expired" || cert.status === "revoked") {
        certificate_status = cert.status;
      } else {
        certificate_status = "missing";
      }
    }

    const sol = creds.find((c) => c.kind === "sol" && c.status === "active");
    const gre = creds.find((c) => c.kind === "gre" && c.status === "active");

    const certMeta = (cert?.publicMetadata ?? {}) as Record<string, unknown>;
    const solMeta = (sol?.publicMetadata ?? {}) as Record<string, unknown>;
    const greMeta = (gre?.publicMetadata ?? {}) as Record<string, unknown>;

    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

    return {
      id: row.id,
      organization_id: row.organizationId,
      ruc: row.ruc,
      legal_name: row.legalName,
      trade_name: row.tradeName,
      logo: row.logo
        ? {
            content_type: row.logo.contentType,
            size_bytes: row.logo.sizeBytes,
            width: row.logo.width,
            height: row.logo.height,
            sha256: row.logo.sha256,
            updated_at: row.logo.updatedAt,
          }
        : null,
      environment: row.environment,
      status: (row.status === "disabled" ? "disabled" : "active") as CompanyStatus,
      address: row.address,
      catalog_pin: (row.catalogPin ?? {}) as Record<string, string>,
      timezone: row.timezone,
      pdf_format: row.pdfFormat,
      tax_agent_settings: row.taxAgentSettings,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      certificate_status,
      sol_configured: Boolean(sol),
      gre_configured: Boolean(gre),
      credentials_summary: {
        certificate: cert
          ? {
              status: cert.status,
              subject_cn: typeof certMeta.subject_cn === "string" ? certMeta.subject_cn : null,
              not_before: typeof certMeta.not_before === "string" ? certMeta.not_before : null,
              not_after: typeof certMeta.not_after === "string" ? certMeta.not_after : null,
              rotated_at: iso(cert.rotatedAt),
            }
          : null,
        sol: sol
          ? {
              configured: true,
              username: typeof solMeta.sol_username === "string" ? solMeta.sol_username : null,
              rotated_at: iso(sol.rotatedAt),
            }
          : null,
        gre: gre
          ? {
              configured: true,
              client_id: typeof greMeta.gre_client_id === "string" ? greMeta.gre_client_id : null,
              rotated_at: iso(gre.rotatedAt),
            }
          : null,
      },
    };
  }
}
