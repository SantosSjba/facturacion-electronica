import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { MutedText } from "@/shared/ui/components/muted-text";

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

  const meta = query.data;
  if (!meta) return <ErrorState message="No se recibió información del ruleset" />;

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <MutedText>
        Vista de solo lectura. El pin de la empresa no se edita en esta pantalla.
      </MutedText>
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
      <MutedText as="dt" className="text-xs uppercase">
        {label}
      </MutedText>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
