import { apiRequest } from "@/shared/api/http-client";

export interface PlatformStats {
  signup_requests: {
    received: number;
    under_review: number;
    approved: number;
    rejected: number;
    total: number;
  };
  organizations: {
    active: number;
    suspended: number;
    total: number;
  };
  plans: {
    active: number;
    retired: number;
    total: number;
  };
}

export function fetchPlatformStats(): Promise<PlatformStats> {
  return apiRequest<PlatformStats>("/saas/platform/stats");
}
