import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { cn } from "@/shared/ui/utils";

import { fetchCompany } from "../api";
import { CompanyFormDialog } from "../components/CompanyFormDialog";

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
  const [editOpen, setEditOpen] = useState(false);

  const query = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompany(id ?? ""),
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
          <div className="flex gap-2">
            {canWrite ? (
              <Button
                type="button"
                variant="outline"
                size="icon-label-sm"
                aria-label="Editar"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className={buttonIconClassName} />
                <ButtonLabel>Editar</ButtonLabel>
              </Button>
            ) : null}
            <Link
              to="/companies"
              className={cn(
                buttonVariants({ variant: "outline", size: "icon-label-sm" }),
              )}
              aria-label="Lista"
            >
              <ArrowLeft className={buttonIconClassName} />
              <ButtonLabel>Lista</ButtonLabel>
            </Link>
          </div>
        }
      />

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={`/companies/${company.id}/${tab.to}`}
            className={({ isActive }) =>
              cn(
                "px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-b-2 border-brand-500 text-gray-800 dark:text-white/90"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ company, onEdit: () => setEditOpen(true) }} />

      {canWrite && id ? (
        <CompanyFormDialog
          mode="edit"
          companyId={id}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  );
}
