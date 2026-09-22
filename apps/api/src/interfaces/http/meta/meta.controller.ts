import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { RulesetService } from "../../../infrastructure/meta/ruleset.service";
import { Public } from "../decorators/auth.decorators";

@ApiTags("Meta")
@Controller("meta")
export class MetaController {
  constructor(private readonly ruleset: RulesetService) {}

  @Public()
  @Get("ruleset")
  @ApiOperation({
    summary: "Platform SUNAT ruleset / catalog pin defaults (ADR-005)",
  })
  getRuleset() {
    return this.ruleset.getPlatformRuleset();
  }
}
