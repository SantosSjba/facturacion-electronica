import type { CompanyFiltersState } from "../filters";
import { FilterPanel, countActiveFilters } from "@/shared/ui/FilterPanel";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";

const EMPTY: CompanyFiltersState = {
  ruc: "",
  environment: "",
  certificate_status: "",
};

export function CompanyFilters({
  value,
  onChange,
}: {
  value: CompanyFiltersState;
  onChange: (next: CompanyFiltersState) => void;
}) {
  const activeCount = countActiveFilters({
    ruc: value.ruc,
    environment: value.environment,
    certificate_status: value.certificate_status,
  });

  return (
    <FilterPanel
      activeCount={activeCount}
      onClear={() => onChange({ ...EMPTY })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="co-filter-ruc">RUC</Label>
          <Input
            id="co-filter-ruc"
            placeholder="Buscar RUC…"
            value={value.ruc}
            onChange={(e) => onChange({ ...value, ruc: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-filter-env">Ambiente</Label>
          <Select
            id="co-filter-env"
            value={value.environment}
            onChange={(e) =>
              onChange({
                ...value,
                environment: e.target.value as CompanyFiltersState["environment"],
              })
            }
          >
            <option value="">Todos</option>
            <option value="sandbox">sandbox</option>
            <option value="production">production</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-filter-cert">Certificado</Label>
          <Select
            id="co-filter-cert"
            value={value.certificate_status}
            onChange={(e) =>
              onChange({
                ...value,
                certificate_status: e.target
                  .value as CompanyFiltersState["certificate_status"],
              })
            }
          >
            <option value="">Todos</option>
            <option value="missing">missing</option>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="revoked">revoked</option>
          </Select>
        </div>
      </div>
    </FilterPanel>
  );
}
