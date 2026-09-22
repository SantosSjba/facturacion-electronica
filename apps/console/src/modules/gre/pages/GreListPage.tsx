import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { CursorPagination } from "@/shared/ui/Pagination";

import { fetchCompanies, fetchDocuments } from "../api";
import { EmitGreMenu } from "../components/EmitGreMenu";
import { GreFilters } from "../components/GreFilters";
import { GreTable } from "../components/GreTable";
import {
  EMPTY_GRE_FILTERS,
  filtersToParams,
  type GreFiltersState,
} from "../filters";

export function GreListPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("gre:write");
  const [filters, setFilters] = useState<GreFiltersState>(EMPTY_GRE_FILTERS);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [stack, setStack] = useState<string[]>([]);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const docsQuery = useQuery({
    queryKey: ["gre-documents", filters, cursor],
    queryFn: () =>
      fetchDocuments(filtersToParams(filters, { limit: 50, cursor })),
  });

  function onFiltersChange(next: GreFiltersState) {
    setFilters(next);
    setCursor(undefined);
    setStack([]);
  }

  return (
    <div>
      <PageHeader
        title="GRE"
        description="Guías de remisión electrónica (09 remitente / 31 transportista)."
        actions={canWrite ? <EmitGreMenu /> : null}
      />

      {docsQuery.isLoading || companiesQuery.isLoading ? (
        <LoadingState label="Cargando guías…" />
      ) : null}

      {docsQuery.error ? (
        <ErrorState
          message={
            docsQuery.error instanceof Error
              ? docsQuery.error.message
              : "Error al cargar guías"
          }
          onRetry={() => void docsQuery.refetch()}
        />
      ) : null}

      {!docsQuery.isLoading && !docsQuery.error ? (
        <div className="space-y-4">
          <GreFilters
            value={filters}
            onChange={onFiltersChange}
            companies={companiesQuery.data ?? []}
          />
          {(docsQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin guías"
              description="No hay GRE que coincidan con los filtros."
            />
          ) : (
            <>
              <GreTable documents={docsQuery.data?.items ?? []} />
              <CursorPagination
                page={stack.length + 1}
                itemCount={docsQuery.data?.items.length ?? 0}
                canPrevious={stack.length > 0}
                canNext={Boolean(docsQuery.data?.next_cursor)}
                onPrevious={() => {
                  const prev = [...stack];
                  const last = prev.pop();
                  setStack(prev);
                  setCursor(last || undefined);
                }}
                onNext={() => {
                  if (!docsQuery.data?.next_cursor) return;
                  setStack((s) => [...s, cursor ?? ""]);
                  setCursor(docsQuery.data.next_cursor ?? undefined);
                }}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
