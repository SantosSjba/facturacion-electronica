import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";

import { fetchRuleset } from "../../api";
import type { Company } from "../../types";

export function RulesetTab() {
  const { company } = useOutletContext<{ company: Company }>();
  const query = useQuery({
    queryKey: ["meta-ruleset"],
    queryFn: fetchRuleset,
  });

  if (query.isLoading) return <LoadingState label="Cargando ruleset…" />;
  if (query.error) {
    return (
      <ErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Error al cargar ruleset"
        }
      />
    );
  }

  const meta = query.data!;

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-sm text-[var(--muted-foreground)]">
        Vista de solo lectura. El pin de la empresa no se edita en esta pantalla.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Item label="Platform ruleset" value={meta.ruleset_version} />
        <Item
          label="Company catalog_pin.ruleset"
          value={company.catalog_pin?.ruleset ?? "(default platform)"}
        />
        <Item label="Source" value={meta.source ?? "—"} />
        <Item
          label="SHA-256"
          value={
            meta.source_sha256
              ? `${meta.source_sha256.slice(0, 16)}…`
              : "—"
          }
        />
      </dl>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
