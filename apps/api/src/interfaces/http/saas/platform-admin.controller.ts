import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { RequirePlatform } from "../decorators/auth.decorators";

@ApiTags("saas-platform")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/platform")
export class PlatformAdminController {
  @Get("health")
  @ApiOperation({ summary: "Platform admin health (requires platform JWT ctx)" })
  health(): { status: "ok" } {
    return { status: "ok" };
  }
}
