import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  DEFAULT_PAGE_SIZE,
} from "@factosys/ui";

import { fetchCompanies } from "../api";
import { CompanyFilters } from "../components/CompanyFilters";
import { CompanyFormDialog } from "../components/CompanyFormDialog";
import { CompaniesTable } from "../components/CompaniesTable";
import { filterCompanies, type CompanyFiltersState } from "../filters";
import { useCompanyCapacity } from "../use-company-capacity";

export function CompaniesListPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const capacity = useCompanyCapacity(canWrite);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<CompanyFiltersState>({
    ruc: "",
    environment: "",
    certificate_status: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const query = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const filtered = useMemo(() => filterCompanies(query.data ?? [], filters), [query.data, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [filters, pageSize]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Empresas"
        description="Onboarding de empresas, credenciales y series."
        actions={
          canWrite ? (
            <ActionButton
              variant="primary"
              icon={Plus}
              label="Crear empresa"
              disabled={capacity.blocked}
              aria-describedby={capacity.message ? "company-capacity" : undefined}
              onClick={() => setCreateOpen(true)}
            />
          ) : null
        }
      />

      {canWrite && capacity.message ? (
        <div
          id="company-capacity"
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <span>{capacity.message}</span>
          {capacity.reached ? (
            <Link to="/app/plan" className="font-medium text-brand-500 hover:underline">
              Solicitar cambio de plan
            </Link>
          ) : null}
          {capacity.query.isError ? (
            <button
              type="button"
              onClick={() => void capacity.query.refetch()}
              className="font-medium text-brand-500 hover:underline"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {query.isLoading ? <LoadingState variant="table" label="Cargando empresas…" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Error al cargar empresas"}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="space-y-4">
          <CompanyFilters value={filters} onChange={setFilters} />
          {filtered.length === 0 ? (
            <EmptyState
              icon={(query.data?.length ?? 0) === 0 ? Building2 : SearchX}
              title="Sin empresas"
              description={
                (query.data?.length ?? 0) === 0
                  ? "Aún no registras empresas en tu organización."
                  : "No hay empresas que coincidan con los filtros."
              }
            />
          ) : (
            <>
              <CompaniesTable companies={visible} />
              <Pagination
                page={page}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      ) : null}

      {canWrite ? (
        <CompanyFormDialog mode="create" open={createOpen} onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}
