import { NavLink, Outlet, Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { cn } from "@/shared/ui/utils";

import { fetchCompany } from "../api";

const TABS = [
  { to: "overview", label: "Overview" },
  { to: "certificate", label: "Certificado" },
  { to: "sol", label: "SOL" },
  { to: "gre", label: "GRE" },
  { to: "series", label: "Series" },
  { to: "ruleset", label: "Ruleset" },
] as const;

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");

  const query = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompany(id!),
    enabled: Boolean(id),
  });

  if (query.isLoading) return <LoadingState label="Cargando empresa…" />;
  if (query.error || !query.data) {
    return (
      <ErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Empresa no encontrada"
        }
      />
    );
  }

  const company = query.data;

  return (
    <div>
      <PageHeader
        title={company.legal_name}
        description={`${company.ruc} · ${company.environment}`}
        actions={
          <div className="flex gap-3 text-sm">
            {canWrite ? (
              <Link
                to={`/companies/${company.id}/edit`}
                className="text-[var(--primary)] hover:underline"
              >
                Editar
              </Link>
            ) : null}
            <Link to="/companies" className="text-[var(--primary)] hover:underline">
              ← Lista
            </Link>
          </div>
        }
      />

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={`/companies/${company.id}/${tab.to}`}
            className={({ isActive }) =>
              cn(
                "px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-b-2 border-[var(--primary)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ company }} />
    </div>
  );
}
