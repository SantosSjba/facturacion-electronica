import { JsonCatalogAdapter } from "@factosys/sunat-catalogs";

import type {
  SunatValidationInput,
  SunatValidationPort,
  SunatValidationResult,
} from "../ports/sunat-validation.port";
import { EXCEL_RULESET_VERSION } from "../rules/obs-to-error";
import { runP0InvoiceRules } from "../rules/p0-invoice-rules";

/**
 * Excel P0 typed rules for Invoice 01 (doc 29 §6–7).
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

    if (input.documentType !== "01") {
      return {
        ok: false,
        rulesetVersion: EXCEL_RULESET_VERSION,
        issues: [
          {
            severity: "error",
            stage: "excel",
            message: `documentType '${input.documentType}' not supported in Excel P0 (only '01')`,
          },
        ],
      };
    }

    const issues = await runP0InvoiceRules(input.xml, {
      catalogs: this.catalogs,
    });

    return {
      ok: issues.length === 0,
      rulesetVersion: EXCEL_RULESET_VERSION,
      issues,
    };
  }
}
