import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, FileCode2, Hash, Info, Layers, Pin } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { Badge, Card, CardTitle, MutedText, ErrorState, LoadingState, cn } from "@factosys/ui";

import { fetchRuleset } from "../../api";
import type { Company } from "../../types";

export function RulesetTab() {
  const { company } = useOutletContext<{ company: Company }>();
  const query = useQuery({
    queryKey: ["meta-ruleset"],
    queryFn: fetchRuleset,
  });

  if (query.isLoading)
    return <LoadingState variant="detail" showHeader={false} label="Cargando reglas de validación…" />;
  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Error al cargar las reglas de validación"}
      />
    );
  }

  const meta = query.data;
  if (!meta) return <ErrorState message="No se recibió información de las reglas de validación" />;

  const companyPin = company.catalog_pin?.ruleset;
  const usingDefault = !companyPin;
  const shaPreview = meta.source_sha256 ? `${meta.source_sha256.slice(0, 16)}…` : null;

  return (
    <div className="space-y-4">
      <Card className="border-brand-100 bg-brand-25/40 dark:border-brand-500/20 dark:bg-brand-500/5">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
            <Info className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              Vista de solo lectura
            </p>
            <MutedText className="mt-0.5">
              La versión de reglas de la empresa no se edita en esta pantalla. Muestra la versión de reglas de
              validación activa en la plataforma.
            </MutedText>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <MetaCard
          icon={Layers}
          label="Reglas de la plataforma"
          value={meta.ruleset_version}
          badge={<Badge variant="primary">plataforma</Badge>}
          mono
        />
        <MetaCard
          icon={Pin}
          label="Versión de reglas de la empresa"
          value={companyPin ?? "Predeterminado de la plataforma"}
          badge={
            <Badge variant={usingDefault ? "muted" : "success"}>
              {usingDefault ? "Predeterminado" : "Fijado"}
            </Badge>
          }
          mono
        />
        <MetaCard icon={BookMarked} label="Fuente" value={meta.source ?? "—"} />
        <MetaCard
          icon={Hash}
          label="SHA-256"
          value={shaPreview ?? "—"}
          title={meta.source_sha256 ?? undefined}
          mono
        />
      </section>

      {meta.default_for?.length || meta.supported?.length ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">
              <FileCode2 className="size-4" />
            </span>
            <CardTitle className="mb-0">Cobertura</CardTitle>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {meta.default_for?.length ? (
              <TagList label="Predeterminado para" items={meta.default_for} />
            ) : null}
            {meta.supported?.length ? <TagList label="Tipos admitidos" items={meta.supported} /> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
  badge,
  mono,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <MutedText className="text-xs uppercase tracking-wide">{label}</MutedText>
            {badge}
          </div>
          <p
            className={cn(
              "break-all text-sm font-semibold text-gray-800 dark:text-white/90",
              mono && "font-mono text-xs",
            )}
            title={title}
          >
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <MutedText className="mb-2 text-xs uppercase tracking-wide">{label}</MutedText>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
