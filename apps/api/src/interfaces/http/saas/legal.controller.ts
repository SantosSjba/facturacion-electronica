import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../decorators/auth.decorators";

@ApiTags("saas-legal")
@Controller("saas/legal")
export class LegalController {
  @Public()
  @Get("documents")
  @ApiOperation({ summary: "List legal documents (stub)" })
  listDocuments(): { items: unknown[] } {
    return { items: [] };
  }
}
