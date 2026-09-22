import type { CertificateStatus, Company, CompanyEnvironment } from "./types";

export interface CompanyFiltersState {
  ruc: string;
  environment: "" | CompanyEnvironment;
  certificate_status: "" | CertificateStatus;
}

export function filterCompanies(
  companies: readonly Company[],
  filters: CompanyFiltersState,
): Company[] {
  const rucQ = filters.ruc.trim();
  return companies.filter((c) => {
    if (rucQ && !c.ruc.includes(rucQ)) return false;
    if (filters.environment && c.environment !== filters.environment) {
      return false;
    }
    if (
      filters.certificate_status &&
      c.certificate_status !== filters.certificate_status
    ) {
      return false;
    }
    return true;
  });
}
