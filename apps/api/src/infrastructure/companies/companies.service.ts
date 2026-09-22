import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { isValidRuc } from "@factosys/domain";
import {
  companies,
  credentials,
  newId,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";

export type CompanyEnvironment = "sandbox" | "production";

export interface CompanyPublic {
  id: string;
  organization_id: string;
  ruc: string;
  legal_name: string;
  trade_name: string | null;
  environment: string;
  address: unknown;
  catalog_pin: Record<string, string>;
  timezone: string;
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

  async create(
    organizationId: string,
    input: {
      ruc: string;
      legalName: string;
      tradeName?: string | null;
      environment: CompanyEnvironment;
      address?: Record<string, unknown> | null;
      timezone?: string;
    },
  ): Promise<CompanyPublic> {
    if (!isValidRuc(input.ruc)) {
      throw AppError.validation("Invalid RUC", [
        { path: "ruc", issue: "checksum or length invalid" },
      ]);
    }

    const existing = await this.db
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
      throw AppError.conflict(
        "Company already exists for this RUC and environment",
      );
    }

    const id = newId();
    await this.db.insert(companies).values({
      id,
      organizationId,
      ruc: input.ruc,
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      environment: input.environment,
      address: input.address ?? null,
      timezone: input.timezone ?? "America/Lima",
    });

    return this.get(organizationId, id);
  }

  async list(organizationId: string): Promise<CompanyPublic[]> {
    const rows = await this.db
      .select()
      .from(companies)
      .where(eq(companies.organizationId, organizationId));
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
      legalName?: string;
      tradeName?: string | null;
      address?: Record<string, unknown> | null;
      timezone?: string;
    },
  ): Promise<CompanyPublic> {
    await this.requireCompany(organizationId, companyId);
    const patch: {
      legalName?: string;
      tradeName?: string | null;
      address?: Record<string, unknown> | null;
      timezone?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (input.legalName !== undefined) patch.legalName = input.legalName;
    if (input.tradeName !== undefined) patch.tradeName = input.tradeName;
    if (input.address !== undefined) patch.address = input.address;
    if (input.timezone !== undefined) patch.timezone = input.timezone;

    await this.db.update(companies).set(patch).where(eq(companies.id, companyId));
    return this.get(organizationId, companyId);
  }

  async requireCompany(organizationId: string, companyId: string) {
    const rows = await this.db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Company not found");
    }
    return row;
  }

  private async toPublic(
    row: typeof companies.$inferSelect,
  ): Promise<CompanyPublic> {
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
      if (
        cert.status === "active" ||
        cert.status === "expired" ||
        cert.status === "revoked"
      ) {
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

    const iso = (d: Date | null | undefined) =>
      d ? d.toISOString() : null;

    return {
      id: row.id,
      organization_id: row.organizationId,
      ruc: row.ruc,
      legal_name: row.legalName,
      trade_name: row.tradeName,
      environment: row.environment,
      address: row.address,
      catalog_pin: (row.catalogPin ?? {}) as Record<string, string>,
      timezone: row.timezone,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      certificate_status,
      sol_configured: Boolean(sol),
      gre_configured: Boolean(gre),
      credentials_summary: {
        certificate: cert
          ? {
              status: cert.status,
              subject_cn:
                typeof certMeta.subject_cn === "string"
                  ? certMeta.subject_cn
                  : null,
              not_before:
                typeof certMeta.not_before === "string"
                  ? certMeta.not_before
                  : null,
              not_after:
                typeof certMeta.not_after === "string"
                  ? certMeta.not_after
                  : null,
              rotated_at: iso(cert.rotatedAt),
            }
          : null,
        sol: sol
          ? {
              configured: true,
              username:
                typeof solMeta.sol_username === "string"
                  ? solMeta.sol_username
                  : null,
              rotated_at: iso(sol.rotatedAt),
            }
          : null,
        gre: gre
          ? {
              configured: true,
              client_id:
                typeof greMeta.gre_client_id === "string"
                  ? greMeta.gre_client_id
                  : null,
              rotated_at: iso(gre.rotatedAt),
            }
          : null,
      },
    };
  }
}
