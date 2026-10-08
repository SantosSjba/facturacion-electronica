import { apiRequest } from "@/shared/api/http-client";

export interface OnboardingStatus {
  complete: boolean;
  has_company: boolean;
  requires_reaccept: boolean;
  organization_id: string;
  organization_name: string;
  organization_slug: string | null;
  legal: {
    privacy: boolean;
    terms: boolean;
  };
  hints: {
    company_name: string | null;
    ruc: string | null;
  } | null;
}

export interface OnboardingLegalDoc {
  id: string;
  code: string;
  version: number;
  title: string;
  body_md: string;
  hash: string;
}

export function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return apiRequest("/saas/onboarding/status");
}

export function fetchOnboardingLegal(): Promise<{
  items: OnboardingLegalDoc[];
}> {
  return apiRequest("/saas/onboarding/legal");
}

export function acceptOnboardingLegal(documentIds: string[]): Promise<OnboardingStatus> {
  return apiRequest("/saas/onboarding/accept-legal", {
    method: "POST",
    body: { document_ids: documentIds },
  });
}

export function createCompany(input: {
  ruc: string;
  legal_name: string;
  trade_name?: string | null;
  environment: "sandbox" | "production";
  seed_default_series?: boolean;
}): Promise<{ id: string }> {
  return apiRequest("/companies", {
    method: "POST",
    body: input,
  });
}
