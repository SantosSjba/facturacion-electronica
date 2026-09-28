import { apiRequest } from "@/shared/api/http-client";

export type OrgStatus = "active" | "suspended";

export interface OrgCurrentPlan {
  id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  status: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  status: OrgStatus;
  is_platform: boolean;
  current_plan: OrgCurrentPlan | null;
  created_at: string;
  updated_at: string;
}

export function fetchOrganizations(params?: {
  status?: OrgStatus;
  q?: string;
}): Promise<{ items: Organization[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const q = qs.toString();
  return apiRequest(`/saas/organizations${q ? `?${q}` : ""}`);
}

export function fetchOrganization(id: string): Promise<Organization> {
  return apiRequest(`/saas/organizations/${id}`);
}

export function patchOrganization(
  id: string,
  body: { status: OrgStatus },
): Promise<Organization> {
  return apiRequest(`/saas/organizations/${id}`, {
    method: "PATCH",
    body,
  });
}

export function impersonateOrganization(body: {
  organization_id: string;
  reason: string;
  ttl_minutes?: number;
}): Promise<{
  access_token: string;
  expires_in: number;
  organization_id: string;
  organization_name: string;
  reason: string;
}> {
  return apiRequest("/saas/platform/impersonate", { method: "POST", body });
}

export function assignOrgPlan(body: {
  organization_id: string;
  plan_id: string;
  status?: "trialing" | "active";
}): Promise<unknown> {
  return apiRequest("/saas/org-plans", { method: "POST", body });
}
