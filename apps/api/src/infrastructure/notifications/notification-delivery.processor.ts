import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import {
  notificationDeliveries,
  notificationTemplates,
  type Db,
} from "@factosys/db";

import { DB } from "../persistence/db.tokens";
import type { QueueJobData } from "../queues/queue.tokens";
import { QueueProducer } from "../queues/queue.producer";
import { EmailService, renderTemplate } from "./email.service";

const RETRY_DELAYS_MS = [15_000, 60_000, 300_000, 900_000, 3_600_000];
const MAX_ATTEMPTS = 5;

@Injectable()
export class NotificationDeliveryProcessor {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly email: EmailService,
    private readonly queues: QueueProducer,
  ) {}

  async process(job: Job<QueueJobData>): Promise<{ ok: true; status: string }> {
    const { deliveryId } = job.data;
    if (!deliveryId) {
      throw new Error("notifications job missing deliveryId");
    }

    const rows = await this.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, deliveryId))
      .limit(1);
    const delivery = rows[0];
    if (!delivery) {
      this.logger.warn(`Notification delivery ${deliveryId} not found`);
      return { ok: true, status: "missing" };
    }
    if (delivery.status === "success") {
      return { ok: true, status: "success" };
    }

    const tplRows = await this.db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.code, delivery.templateCode))
      .limit(1);
    const tpl = tplRows[0];
    if (!tpl) {
      await this.markFailed(delivery.id, delivery.attemptCount + 1, {
        lastError: `Template not found: ${delivery.templateCode}`,
        exhausted: true,
      });
      return { ok: true, status: "failed" };
    }

    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(delivery.payload ?? {})) {
      vars[k] = v == null ? "" : String(v);
    }

    const subject = renderTemplate(tpl.subject, vars);
    const text = renderTemplate(tpl.bodyMd, vars);
    const attemptCount = delivery.attemptCount + 1;

    try {
      const sent = await this.email.send({
        to: delivery.toEmail,
        subject,
        text,
      });
      const now = new Date();
      await this.db
        .update(notificationDeliveries)
        .set({
          status: "success",
          attemptCount,
          providerMessageId: sent.providerMessageId,
          lastError: null,
          nextAttemptAt: null,
          updatedAt: now,
        })
        .where(eq(notificationDeliveries.id, delivery.id));
      return { ok: true, status: "success" };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : String(cause);
      const exhausted = attemptCount >= MAX_ATTEMPTS;
      await this.markFailed(delivery.id, attemptCount, {
        lastError: message,
        exhausted,
      });
      if (!exhausted) {
        const delay =
          RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)] ??
          60_000;
        await this.queues.enqueue(
          "notifications",
          {
            organizationId: job.data.organizationId,
            companyId: job.data.companyId,
            deliveryId: delivery.id,
          },
          {
            jobId: `notif-${delivery.id}-a${attemptCount}`,
            delay,
          },
        );
      }
      return { ok: true, status: exhausted ? "failed" : "retry" };
    }
  }

  private async markFailed(
    deliveryId: string,
    attemptCount: number,
    opts: { lastError: string; exhausted: boolean },
  ): Promise<void> {
    await this.db
      .update(notificationDeliveries)
      .set({
        status: opts.exhausted ? "failed" : "pending",
        attemptCount,
        lastError: opts.lastError.slice(0, 2000),
        nextAttemptAt: opts.exhausted ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, deliveryId));
  }
}
