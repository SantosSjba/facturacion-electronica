import { apiRequest } from "@/shared/api/http-client";

export function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  return apiRequest<void>("/auth/change-password", {
    method: "POST",
    body: input,
  });
}
