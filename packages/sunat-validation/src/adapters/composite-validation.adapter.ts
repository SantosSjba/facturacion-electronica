import type {
  SunatValidationInput,
  SunatValidationIssue,
  SunatValidationPort,
  SunatValidationResult,
  SunatValidationStage,
} from "../ports/sunat-validation.port";
import { ExcelP0ValidationAdapter } from "./excel-p0.adapter";
import { XmllintXsdValidationAdapter } from "./xmllint-xsd.adapter";

const DEFAULT_STAGES: SunatValidationStage[] = ["xsd", "excel"];

/**
 * Runs requested stages (xsd / excel) and merges issues.
 */
export class CompositeSunatValidationAdapter implements SunatValidationPort {
  constructor(
    private readonly xsd: SunatValidationPort = new XmllintXsdValidationAdapter(),
    private readonly excel: SunatValidationPort = new ExcelP0ValidationAdapter(),
  ) {}

  async validateXml(
    input: SunatValidationInput,
  ): Promise<SunatValidationResult> {
    const stages = input.stages?.length ? input.stages : DEFAULT_STAGES;
    const issues: SunatValidationIssue[] = [];
    const versions: string[] = [];

    if (stages.includes("xsd")) {
      const r = await this.xsd.validateXml({
        ...input,
        stages: ["xsd"],
      });
      versions.push(r.rulesetVersion);
      issues.push(...r.issues);
    }

    if (stages.includes("excel")) {
      const r = await this.excel.validateXml({
        ...input,
        stages: ["excel"],
      });
      versions.push(r.rulesetVersion);
      issues.push(...r.issues);
    }

    return {
      ok: issues.length === 0,
      rulesetVersion: versions.join("+") || "unknown",
      issues,
    };
  }
}
