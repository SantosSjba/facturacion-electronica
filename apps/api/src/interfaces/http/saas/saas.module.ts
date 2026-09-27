import { Module } from "@nestjs/common";

import { LegalDocumentsService } from "../../../infrastructure/legal/legal-documents.service";
import { LegalController } from "./legal.controller";
import { NotificationsController } from "./notifications.controller";
import { PlansController } from "./plans.controller";
import { PlatformAdminController } from "./platform-admin.controller";
import { SignupRequestsController } from "./signup-requests.controller";

@Module({
  controllers: [
    PlansController,
    SignupRequestsController,
    LegalController,
    NotificationsController,
    PlatformAdminController,
  ],
  providers: [LegalDocumentsService],
  exports: [LegalDocumentsService],
})
export class SaasModule {}
