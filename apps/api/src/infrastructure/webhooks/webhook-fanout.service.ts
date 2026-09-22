import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import {
  documents,
  newId,
  webhookDeliveries,
  webhookEndpoints,
  type Db,
} from "@factosys/db";

import { QueueProducer } from "../queues/queue.producer";
import { DB } from "../persistence/db.tokens";
import { WEBHOOK_EVENT } from "./webhooks.service";

const NOTIFIABLE = new Set([
  "validated",
  "queued",
  "sent",
  "ticket_pending",
  "accepted",
  "accepted_with_observation",
  "rejected",
  "failed",
  "cancelled",
]);

export interface StatusChangedInput {
  organizationId: string;
  companyId: string;
  documentId: string;
  status: string;
  previousStatus?: string | null;
  eventId: string;
  sunatCode?: string | null;
  sunatMessage?: string | null;
}

@Injectable()
export class WebhookFanoutService {
  private readonly logger = new Logger(WebhookFanoutService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly queues: QueueProducer,
  ) {}

  async onStatusChanged(input: StatusChangedInput): Promise<void> {
    if (!NOTIFIABLE.has(input.status)) {
      return;
    }

    const docRows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, input.documentId))
      .limit(1);
    const doc = docRows[0];
    if (!doc) {
      return;
    }

    const endpoints = await this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.organizationId, input.organizationId),
          eq(webhookEndpoints.status, "active"),
        ),
      );

    const occurredAt = new Date().toISOString();

    for (const endpoint of endpoints) {
      if (
        endpoint.companyId &&
        endpoint.companyId !== input.companyId
      ) {
        continue;
      }
      if (!endpoint.events.includes(WEBHOOK_EVENT)) {
        continue;
      }

      const idempotencyKey = `${endpoint.id}:${input.documentId}:${input.status}:${input.eventId}`;
      const deliveryId = newId();
      const payload = {
        id: deliveryId,
        event: WEBHOOK_EVENT,
        api_version: "v1",
        occurred_at: occurredAt,
        organization_id: input.organizationId,
        data: {
          document_id: input.documentId,
          company_id: input.companyId,
          type: doc.documentType,
          serie_number: doc.serieNumber,
          status: input.status,
          previous_status: input.previousStatus ?? null,
          environment: doc.environment,
          sunat_code: input.sunatCode ?? doc.sunatResponseCode ?? null,
          sunat_message:
            input.sunatMessage ?? doc.sunatResponseMessage ?? null,
          ruleset_version: null,
          links: {
            self: `/v1/documents/${input.documentId}`,
            xml: `/v1/documents/${input.documentId}/xml`,
            cdr: `/v1/documents/${input.documentId}/cdr`,
            pdf: `/v1/documents/${input.documentId}/pdf`,
          },
        },
      };

      try {
        await this.db.insert(webhookDeliveries).values({
          id: deliveryId,
          organizationId: input.organizationId,
          endpointId: endpoint.id,
          documentId: input.documentId,
          eventType: WEBHOOK_EVENT,
          idempotencyKey,
          payload,
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: new Date(),
        });
      } catch (cause) {
        // unique (endpoint_id, idempotency_key) — already enqueued
        this.logger.debug(
          `Skip duplicate webhook delivery ${idempotencyKey}: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
        continue;
      }

      await this.queues.enqueue(
        "webhooks",
        {
          organizationId: input.organizationId,
          companyId: input.companyId,
          documentId: input.documentId,
          deliveryId,
        },
        { jobId: `wh-${deliveryId}` },
      );
    }
  }

  /** Mark delivery success and reset consecutive failures. */
  async markSuccess(deliveryId: string, httpStatus: number): Promise<void> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);
    const delivery = rows[0];
    if (!delivery) return;

    await this.db
      .update(webhookDeliveries)
      .set({
        status: "success",
        httpStatus,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    await this.db
      .update(webhookEndpoints)
      .set({
        consecutiveFailures: 0,
        lastSuccessAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, delivery.endpointId));
  }

  async markAttemptFailure(input: {
    deliveryId: string;
    endpointId: string;
    attemptCount: number;
    httpStatus?: number | null;
    responseExcerpt?: string | null;
    lastError: string;
    exhausted: boolean;
  }): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        status: input.exhausted ? "failed" : "pending",
        attemptCount: input.attemptCount,
        httpStatus: input.httpStatus ?? null,
        responseExcerpt: input.responseExcerpt ?? null,
        lastError: input.lastError,
        nextAttemptAt: input.exhausted ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, input.deliveryId));

    if (input.exhausted) {
      await this.db
        .update(webhookEndpoints)
        .set({
          consecutiveFailures: sql`${webhookEndpoints.consecutiveFailures} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, input.endpointId));

      const ep = await this.db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, input.endpointId))
        .limit(1);
      const endpoint = ep[0];
      if (endpoint && endpoint.consecutiveFailures >= 20) {
        await this.db
          .update(webhookEndpoints)
          .set({
            status: "disabled",
            disabledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(webhookEndpoints.id, input.endpointId));
        this.logger.warn(
          `Auto-disabled webhook endpoint ${input.endpointId} after consecutive failures`,
        );
      }
    }
  }
}
