import { JsonCatalogAdapter } from "@factosys/sunat-catalogs";

import type {
  SunatValidationInput,
  SunatValidationPort,
  SunatValidationResult,
} from "../ports/sunat-validation.port";
import { EXCEL_RULESET_VERSION } from "../rules/obs-to-error";
import { runExcelRulesForType } from "../rules/excel-p1-p2-rules";

/**
 * Excel P0/P1/P2 typed rules for Invoice 01, Boleta 03, NC 07, ND 08.
 */
export class ExcelP0ValidationAdapter implements SunatValidationPort {
  private readonly catalogs: JsonCatalogAdapter;

  constructor(catalogs = new JsonCatalogAdapter()) {
    this.catalogs = catalogs;
  }

  async validateXml(
    input: SunatValidationInput,
  ): Promise<SunatValidationResult> {
    const stages = input.stages ?? ["excel"];
    if (!stages.includes("excel")) {
      return {
        ok: true,
        rulesetVersion: EXCEL_RULESET_VERSION,
        issues: [],
      };
    }

    if (
      input.documentType !== "01" &&
      input.documentType !== "03" &&
      input.documentType !== "07" &&
      input.documentType !== "08"
    ) {
      return {
        ok: false,
        rulesetVersion: EXCEL_RULESET_VERSION,
        issues: [
          {
            severity: "error",
            stage: "excel",
            message: `documentType '${input.documentType}' not supported in Excel gate`,
          },
        ],
      };
    }

    const issues = await runExcelRulesForType(input.documentType, input.xml, {
      catalogs: this.catalogs,
    });

    return {
      ok: issues.length === 0,
      rulesetVersion: EXCEL_RULESET_VERSION,
      issues,
    };
  }
}
