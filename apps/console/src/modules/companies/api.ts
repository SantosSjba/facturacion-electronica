import { apiRequest } from "@/shared/api/http-client";

import type {
  Company,
  CreateCompanyInput,
  CreateSeriesInput,
  DocumentSeries,
  PatchCompanyInput,
  RulesetMeta,
} from "./types";

export function fetchCompanies(): Promise<Company[]> {
  return apiRequest<Company[]>("/companies");
}

export function fetchCompany(id: string): Promise<Company> {
  return apiRequest<Company>(`/companies/${id}`);
}

export function createCompany(input: CreateCompanyInput): Promise<Company> {
  return apiRequest<Company>("/companies", { method: "POST", body: input });
}

export function patchCompany(
  id: string,
  input: PatchCompanyInput,
): Promise<Company> {
  return apiRequest<Company>(`/companies/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function putCertificate(
  companyId: string,
  file: File,
  password: string,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("password", password);
  return apiRequest<void>(`/companies/${companyId}/certificate`, {
    method: "PUT",
    body: form,
  });
}

export function putSolCredentials(
  companyId: string,
  input: { username: string; password: string },
): Promise<void> {
  return apiRequest<void>(`/companies/${companyId}/sol-credentials`, {
    method: "PUT",
    body: input,
  });
}

export function putGreCredentials(
  companyId: string,
  input: { client_id: string; client_secret: string },
): Promise<void> {
  return apiRequest<void>(`/companies/${companyId}/gre-credentials`, {
    method: "PUT",
    body: input,
  });
}

export function fetchSeries(companyId: string): Promise<DocumentSeries[]> {
  return apiRequest<DocumentSeries[]>(`/companies/${companyId}/series`);
}

export function createSeries(
  companyId: string,
  input: CreateSeriesInput,
): Promise<DocumentSeries> {
  return apiRequest<DocumentSeries>(`/companies/${companyId}/series`, {
    method: "POST",
    body: input,
  });
}

export function patchSeries(
  companyId: string,
  seriesId: string,
  input: { is_active?: boolean; padding?: number },
): Promise<DocumentSeries> {
  return apiRequest<DocumentSeries>(
    `/companies/${companyId}/series/${seriesId}`,
    { method: "PATCH", body: input },
  );
}

export function fetchRuleset(): Promise<RulesetMeta> {
  return apiRequest<RulesetMeta>("/meta/ruleset", { auth: false });
}
