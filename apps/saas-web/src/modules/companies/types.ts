export type CompanyEnvironment = "sandbox" | "production";
export type CompanyStatus = "active" | "disabled";
export type CertificateStatus = "missing" | "active" | "expired" | "revoked";

export interface CredentialsSummary {
  certificate: null | {
    status: string;
    subject_cn: string | null;
    not_before: string | null;
    not_after: string | null;
    rotated_at: string | null;
  };
  sol: null | {
    configured: true;
    username: string | null;
    rotated_at: string | null;
  };
  gre: null | {
    configured: true;
    client_id: string | null;
    rotated_at: string | null;
  };
}

export interface Company {
  id: string;
  organization_id: string;
  ruc: string;
  legal_name: string;
  trade_name: string | null;
  logo?: CompanyLogoMetadata | null;
  environment: CompanyEnvironment | string;
  status: CompanyStatus | string;
  address: Record<string, unknown> | null;
  catalog_pin: Record<string, string>;
  timezone: string;
  pdf_format?: "A4" | "A5" | "TICKET80" | "TICKET58";
  created_at: string;
  updated_at: string;
  certificate_status: CertificateStatus | string;
  sol_configured: boolean;
  gre_configured: boolean;
  credentials_summary?: CredentialsSummary;
}

export interface CompanyLogoMetadata {
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
  updated_at: string;
}

export interface CompanyLogoResponse {
  logo: CompanyLogoMetadata | null;
  data_url: string | null;
}

export interface CreateCompanyInput {
  ruc: string;
  legal_name: string;
  trade_name?: string | null;
  environment: CompanyEnvironment;
  address?: Record<string, unknown> | null;
  timezone?: string;
  pdf_format?: "A4" | "A5" | "TICKET80" | "TICKET58";
  /** Defaults to true on the API — seeds F001/B001/FC01/FD01/T001/V001. */
  seed_default_series?: boolean;
}

export interface PatchCompanyInput {
  environment?: CompanyEnvironment;
  legal_name?: string;
  trade_name?: string | null;
  address?: Record<string, unknown> | null;
  timezone?: string;
  pdf_format?: "A4" | "A5" | "TICKET80" | "TICKET58";
  status?: CompanyStatus;
}

export interface DocumentSeries {
  id: string;
  organizationId: string;
  companyId: string;
  documentType: string;
  serie: string;
  nextNumber: number;
  padding: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeriesInput {
  document_type: string;
  serie: string;
  next_number?: number;
  padding?: number;
  is_active?: boolean;
}

export interface RulesetMeta {
  ruleset_version: string;
  source?: string;
  source_sha256?: string;
  default_for?: string[];
  supported?: string[];
}
