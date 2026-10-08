export const MACHINE_SCOPES = [
  "companies:read",
  "companies:write",
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
