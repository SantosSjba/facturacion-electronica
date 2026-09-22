export interface CpeValidationRequest {
  companyId: string;
  ruc: string;
  documentType: string;
  serie: string;
  number: string;
  issueDate: string;
  totalAmount: number;
}

export type CpeStatusLabel =
  | "ACEPTADO"
  | "ANULADO"
  | "NO_EXISTE"
  | "DESCONOCIDO";

export interface CpeValidationResult {
  success: boolean;
  message: string;
  document: {
    ruc: string;
    document_type: string;
    serie: string;
    number: string;
    issue_date: string;
    total_amount: number;
  };
  cpe_status: string;
  cpe_status_label: CpeStatusLabel;
  ruc_status: string;
  ruc_status_label: string;
  domicile_condition: string;
  domicile_condition_label: string;
  observations: string[];
  sunat_error_code: string | null;
  checked_at: string;
  raw: Record<string, unknown>;
}

export interface CpeValidationPort {
  validate(input: CpeValidationRequest): Promise<CpeValidationResult>;
}
