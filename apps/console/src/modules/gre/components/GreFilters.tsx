import type { Company } from "@/modules/companies/types";
import { FilterPanel, countActiveFilters } from "@/shared/ui/FilterPanel";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";

import {
  EMPTY_GRE_FILTERS,
  GRE_STATUS_OPTIONS,
  GRE_TYPE_OPTIONS,
  type GreFiltersState,
} from "../filters";

export function GreFilters({
  value,
  onChange,
  companies,
}: {
  value: GreFiltersState;
  onChange: (next: GreFiltersState) => void;
  companies: Company[];
}) {
  const activeCount = countActiveFilters({
    company_id: value.company_id,
    // Default GRE scope is "09,31" — only count when user changes it
    document_type:
      value.document_type === "09,31" ? "" : value.document_type,
    status: value.status,
    date_from: value.date_from,
    date_to: value.date_to,
    serie_number: value.serie_number,
  });

  return (
    <FilterPanel
      activeCount={activeCount}
      onClear={() => onChange({ ...EMPTY_GRE_FILTERS })}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5">
          <Label htmlFor="gre-filter-company">Empresa</Label>
          <Select
            id="gre-filter-company"
            value={value.company_id}
            onChange={(e) => onChange({ ...value, company_id: e.target.value })}
          >
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.ruc} — {c.legal_name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gre-filter-type">Tipo</Label>
          <Select
            id="gre-filter-type"
            value={value.document_type}
            onChange={(e) =>
              onChange({ ...value, document_type: e.target.value })
            }
          >
            {GRE_TYPE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gre-filter-status">Estado</Label>
          <Select
            id="gre-filter-status"
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value })}
          >
            <option value="">Todos</option>
            {GRE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gre-filter-from">Desde</Label>
          <Input
            id="gre-filter-from"
            type="date"
            value={value.date_from}
            onChange={(e) => onChange({ ...value, date_from: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gre-filter-to">Hasta</Label>
          <Input
            id="gre-filter-to"
            type="date"
            value={value.date_to}
            onChange={(e) => onChange({ ...value, date_to: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gre-filter-serie">Serie-Número</Label>
          <Input
            id="gre-filter-serie"
            placeholder="T001-1"
            value={value.serie_number}
            onChange={(e) =>
              onChange({ ...value, serie_number: e.target.value })
            }
          />
        </div>
      </div>
    </FilterPanel>
  );
}
