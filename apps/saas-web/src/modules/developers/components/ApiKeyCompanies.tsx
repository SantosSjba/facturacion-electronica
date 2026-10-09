import { useQuery } from "@tanstack/react-query";
import { Checkbox, Label, Select } from "@factosys/ui";
import { fetchApiKeyCompanies } from "../api";

export function ApiKeyCompanies({
  ids,
  multi,
  onChange,
  onMultiChange,
}: {
  ids: string[];
  multi: boolean;
  onChange: (ids: string[]) => void;
  onMultiChange: (multi: boolean) => void;
}) {
  const query = useQuery({ queryKey: ["api-key-companies"], queryFn: fetchApiKeyCompanies });
  return (
    <fieldset className="space-y-2">
      <Label htmlFor="key-company-mode">Empresas autorizadas</Label>
      <Select
        id="key-company-mode"
        value={multi ? "multi" : "single"}
        onChange={(e) => {
          onMultiChange(e.target.value === "multi");
          onChange(ids.slice(0, 1));
        }}
      >
        <option value="single">Una empresa</option>
        <option value="multi">Varias empresas (avanzado)</option>
      </Select>
      {query.isLoading ? <p>Cargando empresas…</p> : null}
      {query.error ? <p role="alert">No se pudieron cargar las empresas.</p> : null}
      {!multi ? (
        <Select
          aria-label="Empresa autorizada"
          value={ids[0] ?? ""}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        >
          <option value="">Selecciona la empresa emisora</option>
          {query.data?.map((company) => (
            <option key={company.id} value={company.id}>
              {company.legal_name} · {company.ruc} · {company.environment}
            </option>
          ))}
        </Select>
      ) : (
        query.data?.map((company) => (
          <label key={company.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={ids.includes(company.id)}
              onChange={() =>
                onChange(
                  ids.includes(company.id)
                    ? ids.filter((id) => id !== company.id)
                    : [...ids, company.id],
                )
              }
            />
            {company.legal_name} · {company.ruc} · {company.environment}
          </label>
        ))
      )}
      <p className="text-sm text-gray-500">
        La clave solo podrá operar con las empresas seleccionadas. Cada envío debe indicar su
        company_id.
      </p>
    </fieldset>
  );
}
