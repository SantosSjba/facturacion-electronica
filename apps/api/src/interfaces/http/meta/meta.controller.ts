import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { RulesetService } from "../../../infrastructure/meta/ruleset.service";
import { Public } from "../decorators/auth.decorators";

@ApiTags("Meta / Reglas")
@Controller("meta")
export class MetaController {
  constructor(private readonly ruleset: RulesetService) {}

  @Public()
  @Get("ruleset")
  @ApiOperation({
    summary:
      "Ruleset / catálogos SUNAT de la plataforma (valores por defecto, ADR-005)",
    description:
      "Endpoint público (sin auth) con el ruleset de validación y pines de catálogo usados por la plataforma. Útil para clientes y el SDK (`getRuleset`).",
  })
  getRuleset() {
    return this.ruleset.getPlatformRuleset();
  }
}
