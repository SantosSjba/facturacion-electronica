import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { loadPfx } from "@factosys/sunat-sign";
import { credentials, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { CredentialsVault } from "../crypto/credentials-vault";
import { DB } from "../persistence/db.tokens";

@Injectable()
export class CredentialsResolver {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly vault: CredentialsVault,
  ) {}

  async resolveCertificate(
    companyId: string,
  ): Promise<{ pfx: Buffer; password: string }> {
    const row = await this.requireCredential(companyId, "certificate");
    const secret = await this.vault.getSecret<{
      pfx_base64: string;
      password: string;
    }>(row.secretRef);
    const pfx = Buffer.from(secret.pfx_base64, "base64");
    // Validate still loadable
    loadPfx(pfx, secret.password);
    return { pfx, password: secret.password };
  }

  async resolveSol(
    companyId: string,
  ): Promise<{ username: string; password: string }> {
    const row = await this.requireCredential(companyId, "sol");
    return this.vault.getSecret<{ username: string; password: string }>(
      row.secretRef,
    );
  }

  private async requireCredential(
    companyId: string,
    kind: "certificate" | "sol" | "gre",
  ) {
    const rows = await this.db
      .select()
      .from(credentials)
      .where(
        and(eq(credentials.companyId, companyId), eq(credentials.kind, kind)),
      )
      .limit(1);
    const row = rows[0];
    if (!row || row.status !== "active" || row.secretRef === "pending") {
      throw AppError.validation(`Company missing active ${kind} credentials`, [
        { path: "company_id", issue: `${kind} not configured` },
      ]);
    }
    return row;
  }
}
