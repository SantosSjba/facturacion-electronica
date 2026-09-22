import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { CursorPagination } from "@/shared/ui/Pagination";

import { fetchCompanies, fetchDocuments } from "../api";
import { DocumentFilters } from "../components/DocumentFilters";
import { DocumentsTable } from "../components/DocumentsTable";
import { EmitMenu } from "../components/EmitMenu";
import {
  EMPTY_DOCUMENT_FILTERS,
  filtersToParams,
  type DocumentFiltersState,
} from "../filters";

export function DocumentsListPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("documents:write");
  const [filters, setFilters] = useState<DocumentFiltersState>(
    EMPTY_DOCUMENT_FILTERS,
  );
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [stack, setStack] = useState<string[]>([]);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const docsQuery = useQuery({
    queryKey: ["documents", filters, cursor],
    queryFn: () =>
      fetchDocuments(filtersToParams(filters, { limit: 50, cursor })),
  });

  function onFiltersChange(next: DocumentFiltersState) {
    setFilters(next);
    setCursor(undefined);
    setStack([]);
  }

  return (
    <div>
      <PageHeader
        title="Comprobantes"
        description="Lista, detalle y emisión de CPE (01/03/07/08/RA/RC)."
        actions={canWrite ? <EmitMenu /> : null}
      />

      {docsQuery.isLoading || companiesQuery.isLoading ? (
        <LoadingState label="Cargando comprobantes…" />
      ) : null}

      {docsQuery.error ? (
        <ErrorState
          message={
            docsQuery.error instanceof Error
              ? docsQuery.error.message
              : "Error al cargar comprobantes"
          }
          onRetry={() => void docsQuery.refetch()}
        />
      ) : null}

      {!docsQuery.isLoading && !docsQuery.error ? (
        <div className="space-y-4">
          <DocumentFilters
            value={filters}
            onChange={onFiltersChange}
            companies={companiesQuery.data ?? []}
          />
          {(docsQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin comprobantes"
              description="No hay documentos que coincidan con los filtros."
            />
          ) : (
            <>
              <DocumentsTable documents={docsQuery.data?.items ?? []} />
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
