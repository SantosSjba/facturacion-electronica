import { apiRequest } from "@/shared/api/http-client";

export type PlanChangeStatus = "pending" | "acknowledged" | "closed";

export interface PlatformPlanChangeRequest {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string | null;
  requested_by_email: string;
  current_plan_name: string | null;
  requested_plan_name: string;
  requested_plan_code: string;
  message: string | null;
  status: PlanChangeStatus;
  resolution: "approved" | "rejected" | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function resolvePlanChangeRequest(
  id: string,
  body: { decision: "approve" | "reject"; note?: string },
) {
  return apiRequest(`/saas/platform/plan-change-requests/${id}/resolve`, { method: "POST", body });
}

export function fetchPlatformPlanChangeRequests(filters: {
  status?: PlanChangeStatus;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });
  if (filters.status) params.set("status", filters.status);
  return apiRequest<{ items: PlatformPlanChangeRequest[]; total: number }>(
    `/saas/platform/plan-change-requests?${params}`,
  );
}
