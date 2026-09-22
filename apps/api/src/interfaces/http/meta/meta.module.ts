import { Module } from "@nestjs/common";

import { RulesetService } from "../../../infrastructure/meta/ruleset.service";
import { MetaController } from "./meta.controller";

@Module({
  controllers: [MetaController],
  providers: [RulesetService],
  exports: [RulesetService],
})
export class MetaModule {}
