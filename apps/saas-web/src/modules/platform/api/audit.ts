import { apiRequest } from "@/shared/api/http-client";

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

export interface AuditListParams {
  action?: string;
  actor?: string;
  date_from?: string;
  date_to?: string;
  organization_id?: string;
  limit?: number;
  cursor?: string;
}

export function fetchPlatformAuditEvents(
  params: AuditListParams = {},
): Promise<{ items: AuditEvent[]; next_cursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.action) qs.set("action", params.action);
  if (params.actor) qs.set("actor", params.actor);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.organization_id) qs.set("organization_id", params.organization_id);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/saas/platform/audit-events${suffix}`);
}
