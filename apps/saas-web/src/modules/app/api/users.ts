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

export function fetchOrgUsers(): Promise<OrgUser[]> {
  return apiRequest("/organizations/me/users");
}

export function fetchOrgRoles(): Promise<OrgRole[]> {
  return apiRequest("/organizations/me/roles");
}

export function inviteOrgUser(input: {
  email: string;
  name: string;
  roles: string[];
}): Promise<{
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  invited: boolean;
}> {
  return apiRequest("/organizations/me/users", {
    method: "POST",
    body: { ...input, invite: true },
  });
}
