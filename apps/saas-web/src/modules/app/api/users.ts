import { apiRequest } from "@/shared/api/http-client";

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
}

export interface OrgRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}

function base(organizationId?: string) {
  return organizationId ? `/saas/organizations/${organizationId}` : "/organizations/me";
}
export function fetchOrgUsers(organizationId?: string): Promise<OrgUser[]> {
  return apiRequest(`${base(organizationId)}/users`);
}
export function fetchOrgRoles(organizationId?: string): Promise<OrgRole[]> {
  return apiRequest(`${base(organizationId)}/roles`);
}
export function createOrgUser(
  input: { email: string; name: string; password: string; roles: string[] },
  organizationId?: string,
): Promise<OrgUser> {
  return apiRequest(`${base(organizationId)}/users`, { method: "POST", body: input });
}
export function updateOrgUser(
  id: string,
  input: { name?: string; password?: string; roles?: string[]; status?: "active" | "disabled" },
  organizationId?: string,
): Promise<OrgUser> {
  return apiRequest(`${base(organizationId)}/users/${id}`, { method: "PATCH", body: input });
}
