import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("saas-notifications")
@ApiBearerAuth()
@Controller("saas/notifications")
export class NotificationsController {
  @Get()
  @ApiOperation({ summary: "List notifications (stub)" })
  list(): { items: unknown[] } {
    return { items: [] };
  }
}
