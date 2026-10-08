import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Link, Outlet, useParams, useLocation } from "react-router-dom";
import { TabNavigation } from "@factosys/ui";
import { PortalLink } from "@/app/layout/branding";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  Button,
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
  cn,
} from "@factosys/ui";

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
  const { pathname } = useLocation();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const [editOpen, setEditOpen] = useState(false);

  const query = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompany(id ?? ""),
    enabled: Boolean(id),
  });

  if (query.isLoading) return <LoadingState variant="detail" label="Cargando empresa…" />;
  if (query.error || !query.data) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Empresa no encontrada"}
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
              to="/app/companies"
              className={cn(buttonVariants({ variant: "outline", size: "icon-label-sm" }))}
              aria-label="Lista"
            >
              <ArrowLeft className={buttonIconClassName} />
              <ButtonLabel>Lista</ButtonLabel>
            </Link>
          </div>
        }
      />

      <TabNavigation
        label="Configuración de empresa"
        items={TABS.map((tab) => ({
          href: `/app/companies/${company.id}/${tab.to}`,
          label: tab.label,
        }))}
        pathname={pathname}
        LinkComponent={PortalLink}
      />

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
