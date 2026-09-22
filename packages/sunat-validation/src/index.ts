/**
 * @factosys/sunat-validation — XSD + Excel P0 gate (S1-GATE / S2-VAL).
 */

export const PACKAGE_NAME = "@factosys/sunat-validation" as const;

export {
  SUNAT_VALIDATION_PORT,
  type SunatValidationDocumentType,
  type SunatValidationInput,
  type SunatValidationIssue,
  type SunatValidationPort,
  type SunatValidationResult,
  type SunatValidationStage,
} from "./ports/sunat-validation.port";

export { XmllintXsdValidationAdapter } from "./adapters/xmllint-xsd.adapter";
export { ExcelP0ValidationAdapter } from "./adapters/excel-p0.adapter";
export { CompositeSunatValidationAdapter } from "./adapters/composite-validation.adapter";

export {
  INVOICE_XSD_RELATIVE,
  COMMON_XSD_DIR_RELATIVE,
  XSD_CACHE_RELATIVE,
  resolveCommonXsdDir,
  resolveRootXsdPath,
  resolveXsdCacheRoot,
  type SupportedXsdDocumentType,
} from "./schemas/paths";

export {
  EXCEL_RULESET_VERSION,
  isObsMigratedToError,
  loadObsToErrorCodes,
} from "./rules/obs-to-error";
export { P0_SUNAT_CODES, runP0InvoiceRules } from "./rules/p0-invoice-rules";
export {
  P1_SUNAT_CODES,
  P2_SUNAT_CODES,
  runExcelRulesForType,
  runP1BoletaRules,
  runP2NoteRules,
} from "./rules/excel-p1-p2-rules";

export { validationError, validationInternal } from "./errors";
