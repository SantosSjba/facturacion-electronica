import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { AuditFiltersState } from "../filters";

export function AuditFilters({
  value,
  onChange,
}: {
  value: AuditFiltersState;
  onChange: (next: AuditFiltersState) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="space-y-1.5">
        <Label htmlFor="audit-action">Action</Label>
        <Input
          id="audit-action"
          placeholder="api_key.created"
          value={value.action}
          onChange={(e) => onChange({ ...value, action: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-actor">Actor</Label>
        <Input
          id="audit-actor"
          placeholder="user / api key id"
          value={value.actor}
          onChange={(e) => onChange({ ...value, actor: e.target.value })}
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
  );
}
