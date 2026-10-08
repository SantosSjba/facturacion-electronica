import { apiRequest } from "@/shared/api/http-client";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_display: string;
  currency: string;
  active: boolean;
  max_companies: number;
  max_users: number;
  max_documents_per_month: number;
  max_api_keys: number;
  created_at: string;
  updated_at: string;
}

export type PlanWriteBody = {
  code: string;
  name: string;
  description?: string | null;
  price_monthly_cents: number;
  price_display: string;
  currency: string;
  max_companies: number;
  max_users: number;
  max_documents_per_month: number;
  max_api_keys: number;
  active?: boolean;
};

export function fetchAdminPlans(): Promise<{ items: Plan[] }> {
  return apiRequest("/saas/platform/plans");
}

export function createPlan(body: PlanWriteBody): Promise<Plan> {
  return apiRequest("/saas/plans", { method: "POST", body });
}

export function patchPlan(id: string, body: Partial<PlanWriteBody>): Promise<Plan> {
  return apiRequest(`/saas/plans/${id}`, { method: "PATCH", body });
}

export function retirePlan(id: string): Promise<Plan> {
  return apiRequest(`/saas/plans/${id}`, { method: "DELETE" });
}
