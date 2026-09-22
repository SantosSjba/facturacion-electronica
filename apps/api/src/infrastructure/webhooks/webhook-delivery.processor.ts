import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { webhookDeliveries, webhookEndpoints, type Db } from "@factosys/db";

import type { Env } from "../config/env.schema";
import { DB } from "../persistence/db.tokens";
import type { QueueJobData } from "../queues/queue.tokens";
import { QueueProducer } from "../queues/queue.producer";
import { signWebhookPayload } from "./hmac-sign";
import { assertSafeWebhookUrl } from "./ssrf-guard";
import { WebhookFanoutService } from "./webhook-fanout.service";
import { WebhooksService } from "./webhooks.service";

/** ADR-004 retry delays (ms) before attempts 2..8. */
const RETRY_DELAYS_MS = [
  30_000,
  120_000,
  600_000,
  1_800_000,
  7_200_000,
  21_600_000,
  86_400_000,
];

const MAX_ATTEMPTS = 8;

@Injectable()
export class WebhookDeliveryProcessor {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly webhooks: WebhooksService,
    private readonly fanout: WebhookFanoutService,
    private readonly queues: QueueProducer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async process(job: Job<QueueJobData>): Promise<{ ok: true; status: string }> {
    const { deliveryId } = job.data;
    if (!deliveryId) {
      throw new Error("webhooks job missing deliveryId");
    }

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);
    const delivery = rows[0];
    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found`);
      return { ok: true, status: "missing" };
    }
    if (delivery.status === "success") {
      return { ok: true, status: "success" };
    }

    const epRows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, delivery.endpointId))
      .limit(1);
    const endpoint = epRows[0];
    if (!endpoint || endpoint.status !== "active") {
      await this.fanout.markAttemptFailure({
        deliveryId,
        endpointId: delivery.endpointId,
        attemptCount: delivery.attemptCount,
        lastError: "Endpoint disabled or missing",
        exhausted: true,
      });
      return { ok: true, status: "skipped" };
    }

    const attemptCount = delivery.attemptCount + 1;
    const rawBody = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    let secret: string;
    try {
      secret = await this.webhooks.decryptSecret(endpoint.id);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "decrypt secret failed";
      await this.failOrRetry({
        delivery,
        endpointId: endpoint.id,
        attemptCount,
        lastError: message,
        httpStatus: null,
        responseExcerpt: null,
      });
      return { ok: true, status: "failed" };
    }

    const signature = signWebhookPayload(secret, timestamp, rawBody);

    try {
      await assertSafeWebhookUrl(endpoint.url);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "unsafe webhook url";
      await this.fanout.markAttemptFailure({
        deliveryId,
        endpointId: endpoint.id,
        attemptCount,
        lastError: message,
        exhausted: true,
      });
      return { ok: true, status: "failed" };
    }

    const timeoutMs = this.config.get("WEBHOOK_TIMEOUT_MS", { infer: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "Factosys-Webhooks/1.0",
          "X-Factosys-Event": delivery.eventType,
          "X-Factosys-Delivery-Id": delivery.id,
          "X-Factosys-Timestamp": String(timestamp),
          "X-Factosys-Signature": signature,
          "X-Factosys-Signature-Version": "v1",
        },
        body: rawBody,
      });

      const excerpt = (await res.text()).slice(0, 500);
      if (res.status >= 200 && res.status < 300) {
        await this.fanout.markSuccess(deliveryId, res.status);
        return { ok: true, status: "success" };
      }

      await this.failOrRetry({
        delivery,
        endpointId: endpoint.id,
        attemptCount,
        lastError: `HTTP ${res.status}`,
        httpStatus: res.status,
        responseExcerpt: excerpt,
      });
      return { ok: true, status: "retry" };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "webhook delivery error";
      await this.failOrRetry({
        delivery,
        endpointId: endpoint.id,
        attemptCount,
        lastError: message,
        httpStatus: null,
        responseExcerpt: null,
      });
      return { ok: true, status: "retry" };
    } finally {
      clearTimeout(timer);
    }
  }

  private async failOrRetry(input: {
    delivery: typeof webhookDeliveries.$inferSelect;
    endpointId: string;
    attemptCount: number;
    lastError: string;
    httpStatus: number | null;
    responseExcerpt: string | null;
  }): Promise<void> {
    const exhausted = input.attemptCount >= MAX_ATTEMPTS;
    await this.fanout.markAttemptFailure({
      deliveryId: input.delivery.id,
      endpointId: input.endpointId,
      attemptCount: input.attemptCount,
      httpStatus: input.httpStatus,
      responseExcerpt: input.responseExcerpt,
      lastError: input.lastError,
      exhausted,
    });

    if (exhausted) {
      return;
    }

    const delayIdx = Math.min(
      input.attemptCount - 1,
      RETRY_DELAYS_MS.length - 1,
    );
    const delay = RETRY_DELAYS_MS[delayIdx] ?? 30_000;
    await this.queues.enqueue(
      "webhooks",
      {
        organizationId: input.delivery.organizationId,
        companyId: "",
        documentId: input.delivery.documentId ?? undefined,
        deliveryId: input.delivery.id,
      },
      {
        jobId: `wh-${input.delivery.id}-a${input.attemptCount}`,
        delay,
      },
    );
  }
}
