import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  newId,
  webhookDeliveries,
  webhookEndpoints,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { Argon2Hasher } from "../crypto/argon2-hasher";
import { CredentialsVault } from "../crypto/credentials-vault";
import { DB } from "../persistence/db.tokens";
import { assertSafeWebhookUrl } from "./ssrf-guard";

const WEBHOOK_EVENT = "document.status_changed" as const;

export interface WebhookEndpointPublic {
  id: string;
  organization_id: string;
  company_id: string | null;
  url: string;
  events: string[];
  status: string;
  secret_hint: string;
  consecutive_failures: number;
  disabled_at: Date | null;
  last_success_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly hasher: Argon2Hasher,
    private readonly vault: CredentialsVault,
  ) {}

  async create(input: {
    organizationId: string;
    companyId?: string | null;
    url: string;
    events?: string[];
  }): Promise<WebhookEndpointPublic & { secret: string }> {
    await assertSafeWebhookUrl(input.url);
    const events = normalizeEvents(input.events);
    const secret = generateWebhookSecret();
    const id = newId();
    const hint = secret.slice(-4);
    const secretHash = await this.hasher.hash(secret);
    const secretEncrypted = this.vault.encryptJson({ secret });

    await this.db.insert(webhookEndpoints).values({
      id,
      organizationId: input.organizationId,
      companyId: input.companyId ?? null,
      url: input.url,
      events,
      status: "active",
      secretHash,
      secretEncrypted,
      secretHint: hint,
    });

    const row = await this.requireEndpoint(input.organizationId, id);
    return { ...this.toPublic(row), secret };
  }

  async list(organizationId: string): Promise<WebhookEndpointPublic[]> {
    const rows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.organizationId, organizationId))
      .orderBy(desc(webhookEndpoints.createdAt));
    return rows.map((r) => this.toPublic(r));
  }

  async get(
    organizationId: string,
    endpointId: string,
  ): Promise<WebhookEndpointPublic> {
    const row = await this.requireEndpoint(organizationId, endpointId);
    return this.toPublic(row);
  }

  async patch(
    organizationId: string,
    endpointId: string,
    patch: {
      events?: string[];
      status?: "active" | "disabled";
      url?: string;
    },
  ): Promise<WebhookEndpointPublic> {
    const row = await this.requireEndpoint(organizationId, endpointId);
    if (patch.url) {
      await assertSafeWebhookUrl(patch.url);
    }

    const nextStatus = patch.status ?? row.status;
    const updates: Partial<typeof webhookEndpoints.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.url) updates.url = patch.url;
    if (patch.events) updates.events = normalizeEvents(patch.events);
    if (patch.status) {
      updates.status = patch.status;
      if (patch.status === "disabled") {
        updates.disabledAt = new Date();
      } else {
        updates.disabledAt = null;
        updates.consecutiveFailures = 0;
      }
    }

    await this.db
      .update(webhookEndpoints)
      .set(updates)
      .where(eq(webhookEndpoints.id, row.id));

    if (nextStatus === "active" && row.status === "disabled") {
      // already reset above
    }

    return this.get(organizationId, endpointId);
  }

  async rotateSecret(
    organizationId: string,
    endpointId: string,
  ): Promise<WebhookEndpointPublic & { secret: string }> {
    const row = await this.requireEndpoint(organizationId, endpointId);
    const secret = generateWebhookSecret();
    const hint = secret.slice(-4);
    const secretHash = await this.hasher.hash(secret);
    const secretEncrypted = this.vault.encryptJson({ secret });

    await this.db
      .update(webhookEndpoints)
      .set({
        secretHash,
        secretEncrypted,
        secretHint: hint,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, row.id));

    const updated = await this.requireEndpoint(organizationId, endpointId);
    return { ...this.toPublic(updated), secret };
  }

  async decryptSecret(endpointId: string): Promise<string> {
    const rows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId))
      .limit(1);
    const row = rows[0];
    if (!row?.secretEncrypted) {
      throw AppError.notFound("Webhook endpoint secret not found");
    }
    const payload = this.vault.decryptJson<{ secret: string }>(
      row.secretEncrypted,
    );
    return payload.secret;
  }

  async listDeliveries(
    organizationId: string,
    endpointId: string,
  ): Promise<(typeof webhookDeliveries.$inferSelect)[]> {
    await this.requireEndpoint(organizationId, endpointId);
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.organizationId, organizationId),
          eq(webhookDeliveries.endpointId, endpointId),
        ),
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(100);
  }

  toPublic(
    row: typeof webhookEndpoints.$inferSelect,
  ): WebhookEndpointPublic {
    return {
      id: row.id,
      organization_id: row.organizationId,
      company_id: row.companyId,
      url: row.url,
      events: row.events,
      status: row.status,
      secret_hint: row.secretHint,
      consecutive_failures: row.consecutiveFailures,
      disabled_at: row.disabledAt,
      last_success_at: row.lastSuccessAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private async requireEndpoint(
    organizationId: string,
    endpointId: string,
  ): Promise<typeof webhookEndpoints.$inferSelect> {
    const rows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Webhook endpoint not found");
    }
    return row;
  }
}

function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

function normalizeEvents(events?: string[]): string[] {
  const list = events?.length ? events : [WEBHOOK_EVENT];
  for (const e of list) {
    if (e !== WEBHOOK_EVENT) {
      throw AppError.validation(`Unsupported webhook event: ${e}`, [
        { path: "events", issue: e },
      ]);
    }
  }
  return [...new Set(list)];
}

export { WEBHOOK_EVENT };
