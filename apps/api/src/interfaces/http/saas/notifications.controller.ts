import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { NotificationsService } from "../../../infrastructure/notifications/notifications.service";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listQuerySchema = z.object({
  status: z.enum(["pending", "success", "failed"]).optional(),
  event_key: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

type ListQuery = z.infer<typeof listQuerySchema>;

@ApiTags("saas-notifications")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "List notification deliveries (platform)",
  })
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    return this.notifications.list({
      status: query.status,
      eventKey: query.event_key,
      limit: query.limit,
    });
  }
}
