import { FilterPanel, countActiveFilters } from "@/shared/ui/FilterPanel";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import {
  emptyAuditFilters,
  type AuditFiltersState,
} from "../lib/audit-filters";

export function AuditFilters({
  value,
  onChange,
}: {
  value: AuditFiltersState;
  onChange: (next: AuditFiltersState) => void;
}) {
  const activeCount = countActiveFilters({
    action: value.action,
    actor: value.actor,
    date_from: value.date_from,
    date_to: value.date_to,
    organization_id: value.organization_id,
  });

  return (
    <FilterPanel
      activeCount={activeCount}
      onClear={() => onChange(emptyAuditFilters())}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <Input
            id="audit-action"
            placeholder="organization.suspended"
            value={value.action}
            onChange={(e) => onChange({ ...value, action: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-actor">Actor</Label>
          <Input
            id="audit-actor"
            placeholder="user id"
            value={value.actor}
            onChange={(e) => onChange({ ...value, actor: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-org">Organization id</Label>
          <Input
            id="audit-org"
            placeholder="uuid (opcional)"
            value={value.organization_id}
            onChange={(e) =>
              onChange({ ...value, organization_id: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">Desde</Label>
          <Input
            id="audit-from"
            type="date"
            value={value.date_from}
            onChange={(e) => onChange({ ...value, date_from: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">Hasta</Label>
          <Input
            id="audit-to"
            type="date"
            value={value.date_to}
            onChange={(e) => onChange({ ...value, date_to: e.target.value })}
          />
        </div>
      </div>
    </FilterPanel>
  );
}
