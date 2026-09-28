import {
  Inject,
  Module,
  forwardRef,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Worker, type ConnectionOptions } from "bullmq";

import { AuthModule } from "../auth/auth.module";

import { LegalDocumentsService } from "../../../infrastructure/legal/legal-documents.service";
import { EmailService } from "../../../infrastructure/notifications/email.service";
import { InAppNotificationsService } from "../../../infrastructure/notifications/in-app-notifications.service";
import { NotificationDeliveryProcessor } from "../../../infrastructure/notifications/notification-delivery.processor";
import { NotificationDispatchService } from "../../../infrastructure/notifications/notification-dispatch.service";
import { NotificationsService } from "../../../infrastructure/notifications/notifications.service";
import {
  BULLMQ_CONNECTION,
  type QueueJobData,
} from "../../../infrastructure/queues/queue.tokens";
import { OrgPlansService } from "../../../infrastructure/saas/org-plans.service";
import { OnboardingService } from "../../../infrastructure/saas/onboarding.service";
import { OrganizationsMeService } from "../../../infrastructure/saas/organizations-me.service";
import { OrgsService } from "../../../infrastructure/saas/orgs.service";
import { PlansService } from "../../../infrastructure/saas/plans.service";
import { PlatformStatsService } from "../../../infrastructure/saas/platform-stats.service";
import { SignupRequestsService } from "../../../infrastructure/saas/signup-requests.service";
import { LegalController } from "./legal.controller";
import { NotificationsController } from "./notifications.controller";
import { OnboardingController } from "./onboarding.controller";
import { OrganizationsMeController } from "./organizations-me.controller";
import { OrgPlansController } from "./org-plans.controller";
import { OrgsController } from "./orgs.controller";
import { PlansController } from "./plans.controller";
import { PlatformAdminController } from "./platform-admin.controller";
import { SignupPublicController } from "./signup-public.controller";
import { SignupRequestsController } from "./signup-requests.controller";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [
    PlansController,
    OrgPlansController,
    OrgsController,
    SignupRequestsController,
    SignupPublicController,
    LegalController,
    NotificationsController,
    PlatformAdminController,
    OnboardingController,
    OrganizationsMeController,
  ],
  providers: [
    LegalDocumentsService,
    SignupRequestsService,
    PlansService,
    OrgPlansService,
    OrgsService,
    PlatformStatsService,
    OnboardingService,
    OrganizationsMeService,
    EmailService,
    NotificationDispatchService,
    NotificationDeliveryProcessor,
    NotificationsService,
    InAppNotificationsService,
  ],
  exports: [
    LegalDocumentsService,
    SignupRequestsService,
    PlansService,
    OrgPlansService,
    OrgsService,
    PlatformStatsService,
    OnboardingService,
    OrganizationsMeService,
    NotificationDispatchService,
    InAppNotificationsService,
  ],
})
export class SaasModule implements OnModuleInit, OnModuleDestroy {
  private workers: Worker<QueueJobData>[] = [];

  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: ConnectionOptions,
    private readonly delivery: NotificationDeliveryProcessor,
  ) {}

  onModuleInit(): void {
    this.workers.push(
      new Worker<QueueJobData>(
        "notifications",
        async (job) => this.delivery.process(job),
        { connection: this.connection, concurrency: 4 },
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
