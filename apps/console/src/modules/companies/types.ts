export type CompanyEnvironment = "sandbox" | "production";
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
  environment: CompanyEnvironment | string;
  address: Record<string, unknown> | null;
  catalog_pin: Record<string, string>;
  timezone: string;
  created_at: string;
  updated_at: string;
  certificate_status: CertificateStatus | string;
  sol_configured: boolean;
  gre_configured: boolean;
  credentials_summary?: CredentialsSummary;
}

export interface CreateCompanyInput {
  ruc: string;
  legal_name: string;
  trade_name?: string | null;
  environment: CompanyEnvironment;
  address?: Record<string, unknown> | null;
  timezone?: string;
}

export interface PatchCompanyInput {
  legal_name?: string;
  trade_name?: string | null;
  address?: Record<string, unknown> | null;
  timezone?: string;
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
