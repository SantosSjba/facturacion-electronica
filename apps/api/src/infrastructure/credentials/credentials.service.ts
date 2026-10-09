import { Inject, Injectable, Optional } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { loadPfx } from "@factosys/sunat-sign";
import { companies, credentials, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import type Redis from "ioredis";
import { CredentialsVault } from "../crypto/credentials-vault";
import { CompaniesService } from "../companies/companies.service";
import { DB } from "../persistence/db.tokens";
import { REDIS } from "../redis/redis.tokens";

@Injectable()
export class CredentialsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companyService: CompaniesService,
    private readonly vault: CredentialsVault,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}
  async putCertificate(
    org: string,
    companyId: string,
    pfx: Buffer,
    password: string,
  ): Promise<void> {
    await this.companyService.requireCompany(org, companyId);
    let meta: ReturnType<typeof loadPfx>;
    try {
      meta = loadPfx(pfx, password);
    } catch {
      throw AppError.validation("Invalid PFX or password", [
        { path: "file", issue: "Cannot load certificate" },
      ]);
    }
    const status = new Date(meta.notAfter).getTime() < Date.now() ? "expired" : "active";
    await this.rotate(
      org,
      companyId,
      "certificate",
      status,
      {
        subject_cn: meta.subjectCn ?? meta.subject,
        subject: meta.subject,
        not_before: meta.notBefore,
        not_after: meta.notAfter,
      },
      { pfx_base64: pfx.toString("base64"), password },
    );
  }
  async putSol(
    org: string,
    companyId: string,
    input: { username: string; password: string },
  ): Promise<void> {
    const company = await this.companyService.requireCompany(org, companyId);
    if (!input.username.startsWith(company.ruc) || input.username.length <= 11)
      throw AppError.validation(
        "SOL username must include this company's RUC and user",
        [{ path: "username", issue: "Must include this company's RUC followed by the SOL user" }],
        {
          httpStatus: 422,
        },
      );
    await this.rotate(org, companyId, "sol", "active", { sol_username: input.username }, input);
    await this.redis?.del("gre:oauth:" + companyId);
  }
  async putGre(
    org: string,
    companyId: string,
    input: { clientId: string; clientSecret: string },
  ): Promise<void> {
    await this.companyService.requireCompany(org, companyId);
    await this.rotate(
      org,
      companyId,
      "gre",
      "active",
      { gre_client_id: input.clientId },
      { client_id: input.clientId, client_secret: input.clientSecret },
    );
    await this.redis?.del("gre:oauth:" + companyId);
  }
  async revoke(org: string, companyId: string, kind: "certificate" | "sol" | "gre") {
    await this.companyService.requireCompany(org, companyId);
    const rows = await this.db
      .update(credentials)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(
        and(
          eq(credentials.organizationId, org),
          eq(credentials.companyId, companyId),
          eq(credentials.kind, kind),
        ),
      )
      .returning({ id: credentials.id });
    if (!rows.length) throw AppError.notFound("Credential not found");
    await this.redis?.del("gre:oauth:" + companyId);
  }
  private async rotate(
    org: string,
    companyId: string,
    kind: "certificate" | "sol" | "gre",
    status: string,
    metadata: Record<string, unknown>,
    secret: unknown,
  ) {
    await this.db.transaction(async (tx) => {
      const [company] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.organizationId, org)))
        .for("update");
      if (!company) throw AppError.notFound("Company not found");
      const [existing] = await tx
        .select()
        .from(credentials)
        .where(and(eq(credentials.companyId, companyId), eq(credentials.kind, kind)));
      const credentialId = existing?.id ?? newId();
      // Immutable encrypted object; switch reference only after the new object is persisted.
      const key =
        this.vault.buildObjectKey({ organizationId: org, companyId, kind, credentialId }) +
        "/" +
        newId();
      const { secretRef } = await this.vault.putSecret(key, secret);
      if (existing)
        await tx
          .update(credentials)
          .set({
            status,
            secretRef,
            publicMetadata: metadata,
            updatedAt: new Date(),
            rotatedAt: new Date(),
          })
          .where(eq(credentials.id, credentialId));
      else
        await tx.insert(credentials).values({
          id: credentialId,
          organizationId: org,
          companyId,
          kind,
          status,
          secretRef,
          publicMetadata: metadata,
          rotatedAt: new Date(),
        });
    });
  }
}
