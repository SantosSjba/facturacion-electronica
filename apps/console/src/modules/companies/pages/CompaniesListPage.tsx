import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { useSession } from "@/shared/auth/session-context";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/shared/ui/Pagination";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";

import { fetchCompanies } from "../api";
import { CompanyFilters } from "../components/CompanyFilters";
import { CompanyFormDialog } from "../components/CompanyFormDialog";
import { CompaniesTable } from "../components/CompaniesTable";
import { filterCompanies, type CompanyFiltersState } from "../filters";

export function CompaniesListPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<CompanyFiltersState>({
    ruc: "",
    environment: "",
    certificate_status: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const query = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const filtered = useMemo(
    () => filterCompanies(query.data ?? [], filters),
    [query.data, filters],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [filters, pageSize]);
  useEffect(
    () => setPage((current) => Math.min(current, pageCount)),
    [pageCount],
  );

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Onboarding de empresas, credenciales y series."
        actions={
          canWrite ? (
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Crear empresa"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className={buttonIconClassName} />
              <ButtonLabel>Crear empresa</ButtonLabel>
            </Button>
          ) : null
        }
      />

      {query.isLoading ? <LoadingState label="Cargando empresas…" /> : null}

      {query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Error al cargar empresas"
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="space-y-4">
          <CompanyFilters value={filters} onChange={setFilters} />
          {filtered.length === 0 ? (
            <EmptyState
              title="Sin empresas"
              description="No hay empresas que coincidan con los filtros."
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
        <CompanyFormDialog
          mode="create"
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}
