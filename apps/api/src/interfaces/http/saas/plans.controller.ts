import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../decorators/auth.decorators";

@ApiTags("saas-plans")
@Controller("saas/plans")
export class PlansController {
  @Public()
  @Get()
  @ApiOperation({ summary: "List SaaS plans (stub)" })
  list(): { items: unknown[] } {
    return { items: [] };
  }
}
