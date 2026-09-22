import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/shared/ui/components/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

import { fetchAuditEvents } from "../api";
import { AuditDetailDrawer } from "../components/AuditDetailDrawer";
import { AuditFilters } from "../components/AuditFilters";
import { AuditTable } from "../components/AuditTable";
import { emptyAuditFilters } from "../filters";
import type { AuditEvent } from "../types";

export function AuditListPage() {
  const [filters, setFilters] = useState(emptyAuditFilters);
  const [applied, setApplied] = useState(emptyAuditFilters);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [accumulated, setAccumulated] = useState<AuditEvent[]>([]);

  const query = useQuery({
    queryKey: ["audit-events", applied, cursor],
    queryFn: () =>
      fetchAuditEvents({
        action: applied.action || undefined,
        actor: applied.actor || undefined,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        limit: 50,
        cursor,
      }),
  });

  const items =
    cursor && accumulated.length > 0
      ? [...accumulated, ...(query.data?.items ?? [])]
      : (query.data?.items ?? []);

  function applyFilters() {
    setAccumulated([]);
    setCursor(undefined);
    setApplied({ ...filters });
  }

  function loadMore() {
    if (!query.data?.next_cursor) return;
    setAccumulated(items);
    setCursor(query.data.next_cursor);
  }

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Eventos de la organización (datos sensibles redactados)."
      />

      <div className="mb-4 space-y-3">
        <AuditFilters value={filters} onChange={setFilters} />
        <Button type="button" size="sm" onClick={applyFilters}>
          Aplicar filtros
        </Button>
      </div>

      {query.isLoading && !cursor ? (
        <LoadingState label="Cargando auditoría…" />
      ) : null}

      {!query.isLoading && query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Error al cargar auditoría"
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        items.length === 0 ? (
          <EmptyState
            title="Sin eventos"
            description="No hay eventos con los filtros actuales."
          />
        ) : (
          <div className="space-y-4">
            <AuditTable events={items} onSelect={setSelected} />
            {query.data?.next_cursor ? (
              <Button
                type="button"
                variant="outline"
                disabled={query.isFetching}
                onClick={loadMore}
              >
                {query.isFetching ? "Cargando…" : "Cargar más"}
              </Button>
            ) : null}
          </div>
        )
      ) : null}

      <AuditDetailDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
