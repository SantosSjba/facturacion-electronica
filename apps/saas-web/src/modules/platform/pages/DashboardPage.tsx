import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Layers,
  LayoutDashboard,
  PieChart,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ActionButton,
  Badge,
  Card,
  DonutChart,
  ErrorState,
  HorizontalBarChart,
  IconTile,
  LoadingState,
  PageHeader,
  SectionCard,
  type ChartDatum,
  type IconTone,
} from "@factosys/ui";
import { fetchPlatformStats } from "../api/stats";

const format = new Intl.NumberFormat("es-PE");
const colors = { brand: "#465fff", success: "#12b76a", warning: "#f79009", error: "#f04438" };
const requestStatuses = ["received", "under_review", "approved", "rejected"];

export function DashboardPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["platform", "stats"],
    queryFn: fetchPlatformStats,
    refetchInterval: 30_000,
  });
  const stats = query.data;
  const pending = stats ? stats.signup_requests.received + stats.signup_requests.under_review : 0;
  const resolved = stats ? stats.signup_requests.approved + stats.signup_requests.rejected : 0;
  const approvedRate =
    resolved && stats ? Math.round((stats.signup_requests.approved / resolved) * 100) : 0;
  const requests: ChartDatum[] = stats
    ? [
        { label: "Recibidas", value: stats.signup_requests.received, color: colors.brand },
        { label: "En revisión", value: stats.signup_requests.under_review, color: colors.warning },
        { label: "Aprobadas", value: stats.signup_requests.approved, color: colors.success },
        { label: "Rechazadas", value: stats.signup_requests.rejected, color: colors.error },
      ]
    : [];
  const organizations: ChartDatum[] = stats
    ? [
        { label: "Activas", value: stats.organizations.active, color: colors.success },
        { label: "Suspendidas", value: stats.organizations.suspended, color: colors.error },
      ]
    : [];
  const updated = query.dataUpdatedAt
    ? new Intl.DateTimeFormat("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Lima",
      }).format(query.dataUpdatedAt)
    : null;

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title="Panel de plataforma"
        description="Una mirada al registro de clientes, las organizaciones y los planes."
        actions={
          <ActionButton
            icon={RefreshCw}
            label="Actualizar"
            pending={query.isFetching}
            onClick={() => void query.refetch()}
          />
        }
      />
      {query.isLoading ? (
        <LoadingState variant="dashboard" label="Cargando resumen de plataforma…" />
      ) : null}
      {query.error ? (
        <ErrorState
          message="No se pudo actualizar el resumen de plataforma."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {stats ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={`size-2 rounded-full ${query.isError ? "bg-warning-500" : "bg-success-500"}`}
              />
              {query.isError
                ? "Mostrando la última consulta disponible"
                : "Resumen actual de la plataforma"}
            </span>
            {updated ? <span>Última actualización: {updated} · hora de Lima</span> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={Building2}
              tone="brand"
              title="Organizaciones"
              value={format.format(stats.organizations.total)}
              detail={`${format.format(stats.organizations.active)} activas · ${format.format(stats.organizations.suspended)} suspendidas`}
              to="/platform/organizations"
            />
            <Metric
              icon={ClipboardList}
              tone="warning"
              title="Solicitudes de registro"
              value={format.format(stats.signup_requests.total)}
              detail={`${format.format(pending)} pendientes de atención`}
              to="/platform/signup-requests"
            />
            <Metric
              icon={CheckCircle2}
              tone="success"
              title="Tasa de aprobación"
              value={resolved ? `${approvedRate}%` : "—"}
              detail={
                resolved
                  ? `${format.format(stats.signup_requests.approved)} de ${format.format(resolved)} solicitudes resueltas`
                  : "Todavía no hay solicitudes resueltas"
              }
              to="/platform/signup-requests?status=approved"
            />
            <Metric
              icon={Layers}
              tone="brand"
              title="Planes disponibles"
              value={format.format(stats.plans.active)}
              detail={`${format.format(stats.plans.retired)} retirados · ${format.format(stats.plans.total)} en el catálogo`}
              to="/platform/plans?active=1"
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-12">
            <SectionCard
              className="xl:col-span-7"
              icon={BarChart3}
              title="Solicitudes por estado"
              description="Distribución de todos los registros recibidos."
              actions={
                <Badge color="light">{format.format(stats.signup_requests.total)} en total</Badge>
              }
            >
              <HorizontalBarChart
                className="py-3"
                label="Solicitudes por estado"
                data={requests}
                onSelect={(index) =>
                  navigate(`/platform/signup-requests?status=${requestStatuses[index]}`)
                }
              />
              <p className="mt-5 border-t border-gray-100 pt-4 text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {stats.signup_requests.total
                  ? "Selecciona un estado para abrir las solicitudes. Los porcentajes corresponden al total recibido."
                  : "El gráfico se completará cuando lleguen las primeras solicitudes."}
              </p>
            </SectionCard>
            <SectionCard
              className="xl:col-span-5"
              icon={PieChart}
              title="Estado de las organizaciones"
              description="Clientes activos y suspendidos."
            >
              <DonutChart
                label="Organizaciones"
                totalLabel="organizaciones"
                data={organizations}
                onSelect={(index) =>
                  navigate(`/platform/organizations?status=${index === 0 ? "active" : "suspended"}`)
                }
              />
              {!stats.organizations.total ? (
                <p className="mt-4 text-center text-theme-xs text-gray-500 dark:text-gray-400">
                  Aún no hay organizaciones de clientes.
                </p>
              ) : null}
            </SectionCard>
          </div>
          <div className="grid gap-6 xl:grid-cols-12">
            <SectionCard
              className="xl:col-span-5"
              icon={Layers}
              title="Catálogo de planes"
              description="Disponibilidad de tu oferta comercial."
            >
              <HorizontalBarChart
                label="Estado del catálogo de planes"
                data={[
                  { label: "Disponibles", value: stats.plans.active, color: colors.brand },
                  { label: "Retirados", value: stats.plans.retired, color: "#98a2b3" },
                ]}
                onSelect={(index) => navigate(`/platform/plans?active=${index === 0 ? "1" : "0"}`)}
              />
              {!stats.plans.total ? (
                <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
                  Crea tu primer plan para ofrecerlo a los clientes.
                </p>
              ) : null}
            </SectionCard>
            <SectionCard
              className="xl:col-span-7"
              icon={ShieldCheck}
              title="Atención pendiente"
              description="Accesos directos para revisar lo que necesita seguimiento."
              tone={pending || stats.organizations.suspended ? "warning" : "success"}
            >
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <AttentionRow
                  label="Nuevas solicitudes"
                  detail="Clientes que esperan una primera revisión"
                  value={stats.signup_requests.received}
                  to="/platform/signup-requests?status=received"
                  color="brand"
                />
                <AttentionRow
                  label="Solicitudes en revisión"
                  detail="Registros que todavía requieren una decisión"
                  value={stats.signup_requests.under_review}
                  to="/platform/signup-requests?status=under_review"
                  color="warning"
                />
                <AttentionRow
                  label="Organizaciones suspendidas"
                  detail="Clientes con el acceso suspendido"
                  value={stats.organizations.suspended}
                  to="/platform/organizations?status=suspended"
                  color="error"
                />
              </div>
              {!pending && !stats.organizations.suspended ? (
                <p className="mt-4 flex items-center gap-2 text-theme-xs text-success-600 dark:text-success-500">
                  <CheckCircle2 className="size-4 shrink-0" />
                  No hay solicitudes de registro pendientes ni organizaciones suspendidas.
                </p>
              ) : null}
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  icon,
  tone,
  title,
  value,
  detail,
  to,
}: {
  icon: LucideIcon;
  tone: IconTone;
  title: string;
  value: string;
  detail: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30"
    >
      <Card className="h-full transition-colors group-hover:border-brand-200 dark:group-hover:border-brand-500/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <IconTile icon={icon} tone={tone} />
          <ArrowRight
            aria-hidden
            className="size-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-brand-500"
          />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="mt-2 break-words text-3xl font-semibold tracking-tight text-gray-900 dark:text-white/90">
          {value}
        </p>
        <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">{detail}</p>
      </Card>
    </Link>
  );
}

function AttentionRow({
  label,
  detail,
  value,
  to,
  color,
}: {
  label: string;
  detail: string;
  value: number;
  to: string;
  color: "brand" | "warning" | "error";
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg py-3 outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 group-hover:text-brand-500 dark:text-white/90">
          {label}
        </p>
        <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{detail}</p>
      </div>
      <Badge color={color === "brand" ? "primary" : color}>{format.format(value)}</Badge>
      <ArrowRight aria-hidden className="size-4 shrink-0 text-gray-400" />
    </Link>
  );
}
