import type { OrgRole } from "../types";
import type { UserFiltersState } from "../filters";
import { FilterPanel, countActiveFilters } from "@/shared/ui/FilterPanel";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";

const EMPTY: UserFiltersState = {
  email: "",
  role: "",
  status: "",
};

export function UserFilters({
  value,
  onChange,
  roles,
}: {
  value: UserFiltersState;
  onChange: (next: UserFiltersState) => void;
  roles: OrgRole[];
}) {
  const activeCount = countActiveFilters({
    email: value.email,
    role: value.role,
    status: value.status,
  });

  return (
    <FilterPanel
      activeCount={activeCount}
      onClear={() => onChange({ ...EMPTY })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-email">Email</Label>
          <Input
            id="filter-email"
            placeholder="Buscar email…"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-role">Rol</Label>
          <Select
            id="filter-role"
            value={value.role}
            onChange={(e) => onChange({ ...value, role: e.target.value })}
          >
            <option value="">Todos</option>
            {roles.map((r) => (
              <option key={r.id} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Estado</Label>
          <Select
            id="filter-status"
            value={value.status}
            onChange={(e) =>
              onChange({
                ...value,
                status: e.target.value as UserFiltersState["status"],
              })
            }
          >
            <option value="">Todos</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </Select>
        </div>
      </div>
    </FilterPanel>
  );
}
