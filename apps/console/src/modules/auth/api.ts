import { apiRequest } from "@/shared/api/http-client";

export interface MeProfile {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  organization_slug: string | null;
  organization_name: string;
  roles: string[];
  permissions: string[];
}

export function fetchMe(): Promise<MeProfile> {
  return apiRequest<MeProfile>("/auth/me");
}

export function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  return apiRequest<void>("/auth/change-password", {
    method: "POST",
    body: input,
  });
}
