export interface AuditFiltersState {
  action: string;
  actor: string;
  date_from: string;
  date_to: string;
  organization_id: string;
}

export const emptyAuditFilters = (): AuditFiltersState => ({
  action: "",
  actor: "",
  date_from: "",
  date_to: "",
  organization_id: "",
});
