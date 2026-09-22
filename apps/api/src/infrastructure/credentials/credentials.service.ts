import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { loadPfx } from "@factosys/sunat-sign";
import { credentials, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { CredentialsVault } from "../crypto/credentials-vault";
import { CompaniesService } from "../companies/companies.service";
import { DB } from "../persistence/db.tokens";

@Injectable()
export class CredentialsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly vault: CredentialsVault,
  ) {}

  async putCertificate(
    organizationId: string,
    companyId: string,
    pfx: Buffer,
    password: string,
  ): Promise<void> {
    await this.companies.requireCompany(organizationId, companyId);

    let meta: ReturnType<typeof loadPfx>;
    try {
      meta = loadPfx(pfx, password);
    } catch (cause) {
      throw AppError.validation("Invalid PFX or password", [
        { path: "file", issue: cause instanceof Error ? cause.message : "load failed" },
      ]);
    }

    const notAfter = new Date(meta.notAfter);
    const status = notAfter.getTime() < Date.now() ? "expired" : "active";

    const credentialId = await this.upsertCredentialRow({
      organizationId,
      companyId,
      kind: "certificate",
      status,
      publicMetadata: {
        subject_cn: meta.subjectCn ?? meta.subject,
        subject: meta.subject,
        not_before: meta.notBefore,
        not_after: meta.notAfter,
      },
    });

    const key = this.vault.buildObjectKey({
      organizationId,
      companyId,
      kind: "certificate",
      credentialId,
    });
    const { secretRef } = await this.vault.putSecret(key, {
      pfx_base64: pfx.toString("base64"),
      password,
    });

    await this.db
      .update(credentials)
      .set({ secretRef, updatedAt: new Date(), rotatedAt: new Date() })
      .where(eq(credentials.id, credentialId));
  }

  async putSol(
    organizationId: string,
    companyId: string,
    input: { username: string; password: string },
  ): Promise<void> {
    await this.companies.requireCompany(organizationId, companyId);
    const credentialId = await this.upsertCredentialRow({
      organizationId,
      companyId,
      kind: "sol",
      status: "active",
      publicMetadata: { sol_username: input.username },
    });
    const key = this.vault.buildObjectKey({
      organizationId,
      companyId,
      kind: "sol",
      credentialId,
    });
    const { secretRef } = await this.vault.putSecret(key, {
      username: input.username,
      password: input.password,
    });
    await this.db
      .update(credentials)
      .set({ secretRef, updatedAt: new Date(), rotatedAt: new Date() })
      .where(eq(credentials.id, credentialId));
  }

  async putGre(
    organizationId: string,
    companyId: string,
    input: { clientId: string; clientSecret: string },
  ): Promise<void> {
    await this.companies.requireCompany(organizationId, companyId);
    const credentialId = await this.upsertCredentialRow({
      organizationId,
      companyId,
      kind: "gre",
      status: "active",
      publicMetadata: { gre_client_id: input.clientId },
    });
    const key = this.vault.buildObjectKey({
      organizationId,
      companyId,
      kind: "gre",
      credentialId,
    });
    const { secretRef } = await this.vault.putSecret(key, {
      client_id: input.clientId,
      client_secret: input.clientSecret,
    });
    await this.db
      .update(credentials)
      .set({ secretRef, updatedAt: new Date(), rotatedAt: new Date() })
      .where(eq(credentials.id, credentialId));
  }

  private async upsertCredentialRow(input: {
    organizationId: string;
    companyId: string;
    kind: "certificate" | "sol" | "gre";
    status: string;
    publicMetadata: Record<string, unknown>;
  }): Promise<string> {
    const existing = await this.db
      .select()
      .from(credentials)
      .where(
        and(
          eq(credentials.companyId, input.companyId),
          eq(credentials.kind, input.kind),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await this.db
        .update(credentials)
        .set({
          status: input.status,
          publicMetadata: input.publicMetadata,
          updatedAt: new Date(),
        })
        .where(eq(credentials.id, existing[0].id));
      return existing[0].id;
    }

    const id = newId();
    await this.db.insert(credentials).values({
      id,
      organizationId: input.organizationId,
      companyId: input.companyId,
      kind: input.kind,
      status: input.status,
      secretRef: "pending",
      publicMetadata: input.publicMetadata,
    });
    return id;
  }
}
