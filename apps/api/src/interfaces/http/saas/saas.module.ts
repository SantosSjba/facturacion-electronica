import { Module } from "@nestjs/common";

import { LegalDocumentsService } from "../../../infrastructure/legal/legal-documents.service";
import { SignupRequestsService } from "../../../infrastructure/saas/signup-requests.service";
import { LegalController } from "./legal.controller";
import { NotificationsController } from "./notifications.controller";
import { PlansController } from "./plans.controller";
import { PlatformAdminController } from "./platform-admin.controller";
import { SignupPublicController } from "./signup-public.controller";
import { SignupRequestsController } from "./signup-requests.controller";

@Module({
  controllers: [
    PlansController,
    SignupRequestsController,
    SignupPublicController,
    LegalController,
    NotificationsController,
    PlatformAdminController,
  ],
  providers: [LegalDocumentsService, SignupRequestsService],
  exports: [LegalDocumentsService, SignupRequestsService],
})
export class SaasModule {}
