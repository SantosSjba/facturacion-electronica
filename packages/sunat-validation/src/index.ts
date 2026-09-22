/**
 * @factosys/sunat-validation — XSD gate (S1-GATE).
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

export {
  INVOICE_XSD_RELATIVE,
  COMMON_XSD_DIR_RELATIVE,
  XSD_CACHE_RELATIVE,
  resolveCommonXsdDir,
  resolveRootXsdPath,
  resolveXsdCacheRoot,
  type SupportedXsdDocumentType,
} from "./schemas/paths";

export { validationError, validationInternal } from "./errors";
