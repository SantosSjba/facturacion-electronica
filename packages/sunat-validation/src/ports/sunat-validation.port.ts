/**
 * Nest / DI token for the active SunatValidationPort adapter.
 */
export const SUNAT_VALIDATION_PORT: unique symbol = Symbol("SunatValidationPort");

/** S1-GATE subset: Invoice (01) + XSD stage only. */
export type SunatValidationDocumentType = "01";
export type SunatValidationStage = "xsd";

export interface SunatValidationIssue {
  severity: "error";
  stage: SunatValidationStage;
  message: string;
  path?: string;
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
 * Port for local/CI SUNAT schema (+ later Excel/XSL) validation (doc 29 §11).
 * S1-GATE implements stage `xsd` for documentType `01` only.
 */
export interface SunatValidationPort {
  validateXml(input: SunatValidationInput): Promise<SunatValidationResult>;
}
