import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useSession } from "@/shared/auth/session-context";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

import { fetchCompanies } from "../api";
import { CompanyFilters } from "../components/CompanyFilters";
import { CompaniesTable } from "../components/CompaniesTable";
import { filterCompanies, type CompanyFiltersState } from "../filters";

export function CompaniesListPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const [filters, setFilters] = useState<CompanyFiltersState>({
    ruc: "",
    environment: "",
    certificate_status: "",
  });

  const query = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const filtered = useMemo(
    () => filterCompanies(query.data ?? [], filters),
    [query.data, filters],
  );

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Onboarding de empresas, credenciales y series."
        actions={
          canWrite ? (
            <Link
              to="/companies/new"
              className="inline-flex h-10 items-center rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            >
              Crear empresa
            </Link>
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
            <CompaniesTable companies={filtered} />
          )}
        </div>
      ) : null}
    </div>
  );
}
