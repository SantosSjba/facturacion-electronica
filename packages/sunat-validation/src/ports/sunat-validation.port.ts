/**
 * Nest / DI token for the active SunatValidationPort adapter.
 */
export const SUNAT_VALIDATION_PORT: unique symbol = Symbol("SunatValidationPort");

/** Invoice (01) for S1/S2 gate. */
export type SunatValidationDocumentType = "01";
export type SunatValidationStage = "xsd" | "excel";

export interface SunatValidationIssue {
  severity: "error";
  stage: SunatValidationStage;
  message: string;
  path?: string;
  /** Official SUNAT return code when known (Excel / CódigosRetorno). */
  sunatCode?: string;
}

export interface SunatValidationInput {
  documentType: SunatValidationDocumentType;
  xml: string;
  stages?: SunatValidationStage[];
}

export interface SunatValidationResult {
  ok: boolean;
  rulesetVersion: string;
  issues: SunatValidationIssue[];
}

/**
 * Port for local/CI SUNAT schema + Excel P0 validation (doc 29 §11).
 * S2-VAL: stages `xsd` | `excel`, documentType `01`.
 */
export interface SunatValidationPort {
  validateXml(input: SunatValidationInput): Promise<SunatValidationResult>;
}
