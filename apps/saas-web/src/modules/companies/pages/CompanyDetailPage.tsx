import { environmentLabel } from "@/shared/ui/display-labels";
import { useState } from "react";
import {
  Building2,
  Fingerprint,
  Hash,
  KeyRound,
  LayoutDashboard,
  Pencil,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Outlet, useParams, useLocation } from "react-router-dom";
import { TabNavigation } from "@factosys/ui";
import { PortalLink } from "@/app/layout/branding";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import { BackLink } from "@/shared/ui/components/action-link";
import { ActionButton, ErrorState, LoadingState, PageHeader } from "@factosys/ui";

import { fetchCompany } from "../api";
import { CompanyFormDialog } from "../components/CompanyFormDialog";

const TABS = [
  { to: "overview", label: "Resumen", icon: LayoutDashboard },
  { to: "certificate", label: "Certificado", icon: ShieldCheck },
  { to: "sol", label: "SOL", icon: KeyRound },
  { to: "gre", label: "GRE", icon: Truck },
  { to: "series", label: "Series", icon: Hash },
  { to: "ruleset", label: "Reglas de validación", icon: Fingerprint },
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
        icon={Building2}
        title={company.legal_name}
        description={`${company.ruc} · ${environmentLabel(company.environment)}`}
        actions={
          <>
            {canWrite ? (
              <ActionButton icon={Pencil} label="Editar" onClick={() => setEditOpen(true)} />
            ) : null}
            <BackLink to="/app/companies" />
          </>
        }
      />

      <TabNavigation
        label="Configuración de empresa"
        items={TABS.map((tab) => ({
          href: `/app/companies/${company.id}/${tab.to}`,
          label: tab.label,
          icon: tab.icon,
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
