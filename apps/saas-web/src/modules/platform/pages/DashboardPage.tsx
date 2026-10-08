import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState, PageHeader, Card, CardTitle, MutedText } from "@factosys/ui";

import { fetchPlatformStats } from "../api/stats";

export function DashboardPage() {
  const query = useQuery({
    queryKey: ["platform", "stats"],
    queryFn: fetchPlatformStats,
  });

  const stats = query.data;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="KPIs de la plataforma. Cada tarjeta abre el listado filtrado."
      />

      {query.isLoading ? <LoadingState label="Cargando KPIs…" /> : null}
      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Error al cargar stats"}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            title="Solicitudes recibidas"
            value={stats.signup_requests.received}
            to="/platform/signup-requests?status=received"
          />
          <KpiCard
            title="En revisión"
            value={stats.signup_requests.under_review}
            to="/platform/signup-requests?status=under_review"
          />
          <KpiCard
            title="Aprobadas"
            value={stats.signup_requests.approved}
            to="/platform/signup-requests?status=approved"
          />
          <KpiCard
            title="Rechazadas"
            value={stats.signup_requests.rejected}
            to="/platform/signup-requests?status=rejected"
          />
          <KpiCard
            title="Orgs activas"
            value={stats.organizations.active}
            to="/platform/organizations?status=active"
          />
          <KpiCard
            title="Orgs suspendidas"
            value={stats.organizations.suspended}
            to="/platform/organizations?status=suspended"
          />
          <KpiCard title="Planes activos" value={stats.plans.active} to="/platform/plans" />
          <KpiCard
            title="Planes retirados"
            value={stats.plans.retired}
            to="/platform/plans?active=0"
          />
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ title, value, to }: { title: string; value: number; to: string }) {
  return (
    <Link to={to} className="block transition hover:opacity-90">
      <Card>
        <CardTitle className="mb-1">{title}</CardTitle>
        <p className="text-3xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
        <MutedText className="mt-2">Ver listado →</MutedText>
      </Card>
    </Link>
  );
}
