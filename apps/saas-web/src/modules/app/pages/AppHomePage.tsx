import { statusLabel } from "@/shared/ui/display-labels";
import { ActionLink } from "@/shared/ui/components/action-link";
import { StatusBadge } from "@/shared/ui/status-badge";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Building2, FileText, Home, KeyRound, Layers, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { fetchOrgPlan } from "@/modules/app/api/plan";
import { useSession } from "@/shared/auth/session-context";
import {
  Card,
  CardTitle,
  ErrorState,
  IconTile,
  LoadingState,
  MutedText,
  PageHeader,
  SectionCard,
} from "@factosys/ui";

function UsageBar({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: LucideIcon;
  label: string;
  used: number;
  limit: number | null;
}) {
  const max = limit ?? 0;
  const reached = limit != null && used >= limit;
  const pct = max <= 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
          <Icon className="size-4 shrink-0 text-gray-400" aria-hidden />
          {label}
        </span>
        <span className="font-medium text-gray-900 dark:text-white">
          {used}
          {limit != null ? ` / ${limit}` : ""}
        </span>
      </div>
      {reached ? (
        <span className="text-theme-xs text-error-500">
          Límite alcanzado
          {label === "Documentos (mes)" ? " · el cupo se renueva el próximo mes" : ""}
        </span>
      ) : null}
      {limit != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full transition-all ${reached ? "bg-error-500" : "bg-brand-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AppHomePage() {
  const { user, hasPermission } = useSession();
  const planQuery = useQuery({
    queryKey: ["org-plan", user?.organizationId],
    queryFn: fetchOrgPlan,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const data = planQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Home}
        title="Inicio"
        description={
          data
            ? `${data.organization_name} · ${data.organization_slug}`
            : "Resumen de plan, uso y accesos rápidos."
        }
      />

      {planQuery.isLoading ? (
        <LoadingState variant="detail" showHeader={false} label="Cargando plan…" />
      ) : null}
      {planQuery.error ? (
        <ErrorState
          message={
            planQuery.error instanceof Error ? planQuery.error.message : "No se pudo cargar el plan"
          }
        />
      ) : null}

      {data ? (
        <>
          <SectionCard
            icon={Layers}
            title="Plan actual"
            description={
              data.org_plan_status ? (
                <StatusBadge
                  status={data.org_plan_status}
                  label={statusLabel(data.org_plan_status)}
                />
              ) : undefined
            }
            actions={
              <ActionLink to="/app/plan" icon={Layers} label="Ver plan / solicitar cambio" />
            }
          >
            <div className="space-y-5">
              {data.plan ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {data.plan.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {data.plan.code} · {data.plan.price_display}
                  </p>
                  {data.plan.description ? (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {data.plan.description}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Tu organización aún no tiene un plan asignado.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <UsageBar
                  icon={Building2}
                  label="Empresas"
                  used={data.usage.companies}
                  limit={data.limits?.max_companies ?? null}
                />
                <UsageBar
                  icon={Users}
                  label="Usuarios"
                  used={data.usage.users}
                  limit={data.limits?.max_users ?? null}
                />
                <UsageBar
                  icon={FileText}
                  label="Documentos (mes)"
                  used={data.usage.documents_this_month}
                  limit={data.limits?.max_documents_per_month ?? null}
                />
                <UsageBar
                  icon={KeyRound}
                  label="API keys"
                  used={data.usage.api_keys}
                  limit={data.limits?.max_api_keys ?? null}
                />
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 sm:grid-cols-3">
            <QuickLinkCard
              icon={Users}
              title="Usuarios"
              text="Crea usuarios y gestiona los accesos de tu equipo."
              to="/app/users"
              cta="Gestionar"
            />
            <QuickLinkCard
              icon={Building2}
              title="Empresas"
              text="Configura tus empresas, certificados, credenciales y series."
              to="/app/companies"
              cta="Gestionar empresas"
            />
            <QuickLinkCard
              icon={KeyRound}
              title="Acceso a la API"
              text="Administra las claves para conectar tus sistemas con la API."
              to={hasPermission("apikeys:manage") ? "/app/developers/api-keys" : undefined}
              cta="Gestionar API keys"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function QuickLinkCard({
  icon,
  title,
  text,
  to,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  to?: string;
  cta: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <IconTile icon={icon} />
      <div className="flex-1 space-y-1">
        <CardTitle className="mb-0">{title}</CardTitle>
        <MutedText>{text}</MutedText>
      </div>
      {to ? (
        <ActionLink
          to={to}
          icon={ArrowRight}
          iconEnd
          label={cta}
          size="sm"
          className="self-start"
        />
      ) : null}
    </Card>
  );
}
