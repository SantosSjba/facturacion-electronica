import { apiRequest } from "@/shared/api/http-client";

import type {
  ApiKey,
  CreateApiKeyInput,
  CreateApiKeyResult,
  CreateWebhookInput,
  CreateWebhookResult,
  WebhookDelivery,
  WebhookEndpoint,
} from "./types";

/** API returns camelCase for API keys (Nest service shape). */
function mapApiKey(raw: Record<string, unknown>): ApiKey {
  return {
    id: String(raw.id),
    companyIds: Array.isArray(raw.companyIds) ? (raw.companyIds as string[]) : [],
    name: String(raw.name),
    keyPrefix: String(raw.keyPrefix ?? raw.key_prefix ?? ""),
    scopes: Array.isArray(raw.scopes) ? (raw.scopes as string[]) : [],
    status: (raw.status as ApiKey["status"]) ?? "active",
    environmentConstraint:
      (raw.environmentConstraint as ApiKey["environmentConstraint"]) ??
      (raw.environment_constraint as ApiKey["environmentConstraint"]) ??
      null,
    lastUsedAt: (raw.lastUsedAt as string | null) ?? (raw.last_used_at as string | null) ?? null,
    revokedAt: (raw.revokedAt as string | null) ?? (raw.revoked_at as string | null) ?? null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
  };
}

function mapCreateApiKey(raw: Record<string, unknown>): CreateApiKeyResult {
  return {
    id: String(raw.id),
    name: String(raw.name),
    keyPrefix: String(raw.keyPrefix ?? raw.key_prefix ?? ""),
    secret: String(raw.secret ?? ""),
    scopes: Array.isArray(raw.scopes) ? (raw.scopes as string[]) : [],
    environmentConstraint:
      (raw.environmentConstraint as string | null) ??
      (raw.environment_constraint as string | null) ??
      null,
  };
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const rows = await apiRequest<Record<string, unknown>[]>("/organizations/me/api-keys");
  return rows.map(mapApiKey);
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  const raw = await apiRequest<Record<string, unknown>>("/organizations/me/api-keys", {
    method: "POST",
    body: input,
  });
  return mapCreateApiKey(raw);
}

export function revokeApiKey(id: string): Promise<{ ok: true }> {
  return apiRequest(`/organizations/me/api-keys/${id}`, { method: "DELETE" });
}

export function fetchApiKeyCompanies(): Promise<
  { id: string; legal_name: string; ruc: string; environment: string }[]
> {
  return apiRequest("/organizations/me/api-keys/companies");
}

export function assignApiKeyCompanies(id: string, company_ids: string[], multi: boolean) {
  return apiRequest(`/organizations/me/api-keys/${id}/companies`, {
    method: "PATCH",
    body: { company_ids, access_mode: multi ? "multi" : "single" },
  });
}

export function fetchWebhooks(): Promise<WebhookEndpoint[]> {
  return apiRequest("/v1/webhook-endpoints");
}

export function createWebhook(input: CreateWebhookInput): Promise<CreateWebhookResult> {
  return apiRequest("/v1/webhook-endpoints", { method: "POST", body: input });
}

export function patchWebhook(
  id: string,
  patch: { url?: string; events?: string[]; status?: "active" | "disabled" },
): Promise<WebhookEndpoint> {
  return apiRequest(`/v1/webhook-endpoints/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export function rotateWebhookSecret(id: string): Promise<WebhookEndpoint & { secret: string }> {
  return apiRequest(`/v1/webhook-endpoints/${id}/rotate-secret`, {
    method: "POST",
  });
}

export function fetchWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  return apiRequest(`/v1/webhook-endpoints/${id}/deliveries`);
}
