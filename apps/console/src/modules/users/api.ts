import { apiRequest } from "@/shared/api/http-client";

import type {
  CreateUserInput,
  OrgRole,
  OrgUser,
  PatchUserInput,
} from "./types";

export function fetchOrgUsers(): Promise<OrgUser[]> {
  return apiRequest<OrgUser[]>("/organizations/me/users");
}

export function fetchOrgRoles(): Promise<OrgRole[]> {
  return apiRequest<OrgRole[]>("/organizations/me/roles");
}

export function createOrgUser(input: CreateUserInput): Promise<{
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
}> {
  return apiRequest("/organizations/me/users", {
    method: "POST",
    body: input,
  });
}

export function patchOrgUser(
  id: string,
  input: PatchUserInput,
): Promise<OrgUser> {
  return apiRequest(`/organizations/me/users/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function putOrgUserRoles(
  id: string,
  roles: string[],
): Promise<OrgUser> {
  return apiRequest(`/organizations/me/users/${id}/roles`, {
    method: "PUT",
    body: { roles },
  });
}
