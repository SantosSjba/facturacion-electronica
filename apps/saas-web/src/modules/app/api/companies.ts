import { apiRequest } from "@/shared/api/http-client";

export interface Company {
  id: string;
  ruc: string;
  legal_name: string;
  trade_name: string | null;
  environment: string;
  status: string;
}

export function fetchCompanies(): Promise<Company[]> {
  return apiRequest("/companies");
}
