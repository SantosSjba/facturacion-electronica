import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import {
  newId,
  notificationDeliveries,
  organizations,
  type Db,
} from "@factosys/db";

import type { Env } from "../config/env.schema";
import { DB } from "../persistence/db.tokens";
import { QueueProducer } from "../queues/queue.producer";
import type { QueueJobData } from "../queues/queue.tokens";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";

const PLATFORM_ORG_SLUG = "factosys-platform";

export interface SignupReceivedInput {
  signupId: string;
  companyName: string;
  ruc: string;
  contactName: string;
  contactEmail: string;
}

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly queues: QueueProducer,
    private readonly config: ConfigService<Env, true>,
    private readonly processor: NotificationDeliveryProcessor,
  ) {}

  /**
   * Enqueue acuse (contact) + received (ops) emails. Idempotent via event_key.
   */
  async signupReceived(input: SignupReceivedInput): Promise<void> {
    const payload = {
      company_name: input.companyName,
      ruc: input.ruc,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      signup_request_id: input.signupId,
    };

    const opsEmail = this.config.get("NOTIFICATIONS_OPS_EMAIL", {
      infer: true,
    });

    await this.enqueueDelivery({
      templateCode: "signup.acuse",
      toEmail: input.contactEmail,
      eventKey: `signup:${input.signupId}:acuse`,
      signupRequestId: input.signupId,
      payload,
    });

    await this.enqueueDelivery({
      templateCode: "signup.received",
      toEmail: opsEmail,
      eventKey: `signup:${input.signupId}:received`,
      signupRequestId: input.signupId,
      payload,
    });
  }

  /** Ops email when a plan is assigned to an organization (S14-PLAN / FE-408). */
  async planAssigned(input: {
    orgPlanId: string;
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    planId: string;
    planCode: string;
    planName: string;
    status: string;
  }): Promise<void> {
    const opsEmail = this.config.get("NOTIFICATIONS_OPS_EMAIL", {
      infer: true,
    });
    await this.enqueueDelivery({
      templateCode: "plan.assigned",
      toEmail: opsEmail,
      eventKey: `plan.assigned:${input.orgPlanId}`,
      payload: {
        organization_id: input.organizationId,
        organization_slug: input.organizationSlug,
        organization_name: input.organizationName,
        plan_id: input.planId,
        plan_code: input.planCode,
        plan_name: input.planName,
        status: input.status,
        org_plan_id: input.orgPlanId,
      },
    });
  }

  private async enqueueDelivery(input: {
    templateCode: string;
    toEmail: string;
    eventKey: string;
    signupRequestId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const deliveryId = newId();
    try {
      await this.db.insert(notificationDeliveries).values({
        id: deliveryId,
        templateCode: input.templateCode,
        toEmail: input.toEmail,
        eventKey: input.eventKey,
        signupRequestId: input.signupRequestId ?? null,
        payload: input.payload,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: new Date(),
      });
    } catch (cause) {
      this.logger.debug(
        `Skip duplicate notification ${input.eventKey}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      return;
    }

    const organizationId = await this.resolvePlatformOrgId();
    const jobData: QueueJobData = {
      organizationId,
      companyId: "",
      deliveryId,
    };
    await this.queues.enqueue("notifications", jobData, {
      jobId: `notif-${deliveryId}`,
    });

    // Sandbox: process immediately so CI/e2e do not depend on Redis worker lag.
    // Worker is still registered; processor no-ops if already success.
    if (this.config.get("EMAIL_DRIVER", { infer: true }) === "log") {
      try {
        await this.processor.process({
          data: jobData,
        } as Job<QueueJobData>);
      } catch (cause) {
        this.logger.warn(
          `sandbox sync process failed delivery=${deliveryId}: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      }
    }
  }

  private async resolvePlatformOrgId(): Promise<string> {
    const rows = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, PLATFORM_ORG_SLUG))
      .limit(1);
    if (rows[0]?.id) {
      return rows[0].id;
    }
    // Fallback UUID so job payload stays well-formed if seed missing.
    return "00000000-0000-7000-8000-000000000001";
  }
}
