export const MACHINE_SCOPES = [
  "documents:read",
  "documents:write",
  "credentials:manage",
  "webhooks:manage",
  "validations:cpe",
] as const;

export type MachineScope = (typeof MACHINE_SCOPES)[number];

export type ApiKeyStatus = "active" | "revoked";

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: ApiKeyStatus;
  environmentConstraint: "sandbox" | "production" | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  environment_constraint?: "sandbox" | "production" | null;
}

export interface CreateApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  secret: string;
  scopes: string[];
  environmentConstraint: string | null;
}

export type WebhookStatus = "active" | "disabled";

export interface WebhookEndpoint {
  id: string;
  organization_id: string;
  company_id: string | null;
  url: string;
  events: string[];
  status: WebhookStatus;
  secret_hint: string;
  consecutive_failures: number;
  disabled_at: string | null;
  last_success_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookInput {
  url: string;
  events?: string[];
  company_id?: string | null;
}

export interface CreateWebhookResult extends WebhookEndpoint {
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  http_status: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  organization_id: string | null;
  company_id: string | null;
  actor_type: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface AuditListResponse {
  items: AuditEvent[];
  next_cursor: string | null;
}

export interface AuditListParams {
  action?: string;
  actor?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  cursor?: string;
}

export interface CpeValidationInput {
  company_id: string;
  ruc: string;
  document_type: string;
  serie: string;
  number: string;
  issue_date: string;
  total_amount: number;
}

export interface CpeValidationResult {
  cpe_status: string;
  cpe_status_label: string;
  ruc_status: string;
  ruc_status_label: string;
  observations?: string | null;
  checked_at: string;
  cached: boolean;
}
