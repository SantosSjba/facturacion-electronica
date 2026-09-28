import { apiRequest } from "@/shared/api/http-client";

export interface OrgPlanMe {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  org_plan_id: string | null;
  org_plan_status: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_display: string;
    currency: string;
  } | null;
  limits: {
    max_companies: number;
    max_users: number;
    max_documents_per_month: number;
    max_api_keys: number;
  } | null;
  usage: {
    companies: number;
    users: number;
    api_keys: number;
    documents_this_month: number;
  };
}

export interface PlanChangeRequest {
  id: string;
  status: string;
  message: string | null;
  current_plan_id: string | null;
  current_plan_code: string | null;
  requested_plan_id: string;
  requested_plan_code: string;
  requested_plan_name: string;
  requested_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_display: string;
  currency: string;
  max_companies: number;
  max_users: number;
  max_documents_per_month: number;
  max_api_keys: number;
}

export function fetchOrgPlan(): Promise<OrgPlanMe> {
  return apiRequest("/organizations/me/plan");
}

export function fetchPlanChangeRequests(): Promise<{
  items: PlanChangeRequest[];
}> {
  return apiRequest("/organizations/me/plan/change-requests");
}

export function requestPlanChange(input: {
  requested_plan_code: string;
  message?: string;
}): Promise<PlanChangeRequest> {
  return apiRequest("/organizations/me/plan/change-requests", {
    method: "POST",
    body: input,
  });
}

export function fetchPublicPlans(): Promise<{ items: PublicPlan[] }> {
  return apiRequest("/saas/plans");
}
