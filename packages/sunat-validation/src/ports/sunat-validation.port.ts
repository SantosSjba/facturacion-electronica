/**
 * Nest / DI token for the active SunatValidationPort adapter.
 */
export const SUNAT_VALIDATION_PORT: unique symbol = Symbol("SunatValidationPort");

/** Invoice (01), Boleta (03), NC (07), ND (08). */
export type SunatValidationDocumentType = "01" | "03" | "07" | "08";
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
 * Port for local/CI SUNAT schema + Excel P0/P1/P2 validation (doc 29 §11).
 * S5: stages `xsd` | `excel`, documentType `01` | `03` | `07` | `08`.
 */
export interface SunatValidationPort {
  validateXml(input: SunatValidationInput): Promise<SunatValidationResult>;
}
