import type { Company } from "@/modules/companies/types";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";

import {
  DOCUMENT_STATUS_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  type DocumentFiltersState,
} from "../filters";

export function DocumentFilters({
  value,
  onChange,
  companies,
}: {
  value: DocumentFiltersState;
  onChange: (next: DocumentFiltersState) => void;
  companies: Company[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div className="space-y-1.5">
        <Label htmlFor="doc-filter-company">Empresa</Label>
        <Select
          id="doc-filter-company"
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
        <Label htmlFor="doc-filter-type">Tipo</Label>
        <Select
          id="doc-filter-type"
          value={value.document_type}
          onChange={(e) =>
            onChange({ ...value, document_type: e.target.value })
          }
        >
          <option value="">Todos</option>
          {DOCUMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-filter-status">Estado</Label>
        <Select
          id="doc-filter-status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">Todos</option>
          {DOCUMENT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-filter-from">Desde</Label>
        <Input
          id="doc-filter-from"
          type="date"
          value={value.date_from}
          onChange={(e) => onChange({ ...value, date_from: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-filter-to">Hasta</Label>
        <Input
          id="doc-filter-to"
          type="date"
          value={value.date_to}
          onChange={(e) => onChange({ ...value, date_to: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-filter-serie">Serie-Número</Label>
        <Input
          id="doc-filter-serie"
          placeholder="F001-1"
          value={value.serie_number}
          onChange={(e) =>
            onChange({ ...value, serie_number: e.target.value })
          }
        />
      </div>
    </div>
  );
}
