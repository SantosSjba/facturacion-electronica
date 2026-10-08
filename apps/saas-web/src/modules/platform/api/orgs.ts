import { getAccessTokenMemory } from "@/shared/api/http-client";
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

export function patchOrganization(id: string, body: { status: OrgStatus }): Promise<Organization> {
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

export interface OrgExportTicket {
  id: string;
  organization_id: string;
  status: "queued" | "processing" | "ready" | "failed";
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export function requestOrgExport(orgId: string): Promise<OrgExportTicket> {
  return apiRequest(`/saas/organizations/${orgId}/exports`, {
    method: "POST",
  });
}

export function fetchOrgExport(orgId: string, exportId: string): Promise<OrgExportTicket> {
  return apiRequest(`/saas/organizations/${orgId}/exports/${exportId}`);
}

/** Poll until ready/failed then download JSON blob. */
export async function downloadOrgExport(orgId: string, exportId: string): Promise<Blob> {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const token = getAccessTokenMemory();
  const res = await fetch(`${base}/saas/organizations/${orgId}/exports/${exportId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || `Download failed (${res.status})`);
  }
  return res.blob();
}

export function assignOrgPlan(body: {
  organization_id: string;
  plan_id: string;
  status?: "trialing" | "active";
}): Promise<unknown> {
  return apiRequest("/saas/org-plans", { method: "POST", body });
}
