import { apiRequest } from "@/shared/api/http-client";

export type SignupStatus =
  | "received"
  | "under_review"
  | "approved"
  | "rejected";

export interface SignupRequest {
  id: string;
  company_name: string;
  ruc: string;
  contact_name: string;
  contact_email: string;
  plan_code: string | null;
  status: SignupStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function fetchSignupRequests(params?: {
  status?: SignupStatus;
  q?: string;
}): Promise<{ items: SignupRequest[]; next_cursor: string | null }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const q = qs.toString();
  return apiRequest(`/saas/signup-requests${q ? `?${q}` : ""}`);
}

export function fetchSignupRequest(id: string): Promise<SignupRequest> {
  return apiRequest(`/saas/signup-requests/${id}`);
}

export function patchSignupRequest(
  id: string,
  body: { status?: SignupStatus; notes?: string | null },
): Promise<SignupRequest> {
  return apiRequest(`/saas/signup-requests/${id}`, {
    method: "PATCH",
    body,
  });
}
