import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { apiKeys, newId, organizations, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { Argon2Hasher } from "../crypto/argon2-hasher";
import { DB } from "../persistence/db.tokens";
import type { ApiKeyAuthContext } from "../../interfaces/http/auth/auth-context";

export const MACHINE_SCOPES = [
  "documents:read",
  "documents:write",
  "credentials:manage",
  "webhooks:manage",
  "validations:cpe",
] as const;

export type MachineScope = (typeof MACHINE_SCOPES)[number];

const KEY_PREFIX_LEN = 8;

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly hasher: Argon2Hasher,
  ) {}

  async create(input: {
    organizationId: string;
    name: string;
    scopes: string[];
    environmentConstraint?: "sandbox" | "production" | null;
  }): Promise<{
    id: string;
    name: string;
    keyPrefix: string;
    secret: string;
    scopes: string[];
    environmentConstraint: string | null;
  }> {
    this.assertScopes(input.scopes);
    const secret = `fsys_${randomBytes(32).toString("base64url")}`;
    const keyPrefix = secret.slice(0, KEY_PREFIX_LEN);
    const keyHash = await this.hasher.hash(secret);
    const id = newId();

    await this.db.insert(apiKeys).values({
      id,
      organizationId: input.organizationId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      status: "active",
      environmentConstraint: input.environmentConstraint ?? null,
    });

    return {
      id,
      name: input.name,
      keyPrefix,
      secret,
      scopes: input.scopes,
      environmentConstraint: input.environmentConstraint ?? null,
    };
  }

  async list(organizationId: string) {
    return this.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        status: apiKeys.status,
        environmentConstraint: apiKeys.environmentConstraint,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, organizationId));
  }

  async revoke(organizationId: string, apiKeyId: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("API key not found");
    }
    if (row.status === "revoked") {
      return;
    }
    await this.db
      .update(apiKeys)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyId));
  }

  /**
   * Validate Bearer API key secret → auth context.
   */
  async authenticate(secret: string): Promise<ApiKeyAuthContext> {
    if (!secret.startsWith("fsys_") || secret.length < KEY_PREFIX_LEN) {
      throw AppError.unauthorized("Invalid API key");
    }
    const keyPrefix = secret.slice(0, KEY_PREFIX_LEN);
    const rows = await this.db
      .select({
        id: apiKeys.id,
        organizationId: apiKeys.organizationId,
        keyHash: apiKeys.keyHash,
        scopes: apiKeys.scopes,
        status: apiKeys.status,
        orgStatus: organizations.status,
      })
      .from(apiKeys)
      .innerJoin(organizations, eq(organizations.id, apiKeys.organizationId))
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    const row = rows[0];
    if (!row || row.status !== "active" || row.orgStatus !== "active") {
      throw AppError.unauthorized("Invalid API key");
    }

    const ok = await this.hasher.verify(row.keyHash, secret);
    if (!ok) {
      throw AppError.unauthorized("Invalid API key");
    }

    void this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.id))
      .catch(() => undefined);

    return {
      kind: "api_key",
      organizationId: row.organizationId,
      apiKeyId: row.id,
      scopes: row.scopes,
    };
  }

  assertScopes(scopes: string[]): void {
    if (scopes.length === 0) {
      throw AppError.validation("scopes must not be empty");
    }
    const allowed = new Set<string>(MACHINE_SCOPES);
    for (const s of scopes) {
      if (!allowed.has(s)) {
        throw AppError.validation(`Unknown scope: ${s}`, [
          { path: "scopes", issue: s },
        ]);
      }
    }
  }
}

/** SHA-256 hex for opaque refresh tokens (not Argon2 — lookup by hash). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
