import { KeyRound, Layers, Users, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchOrgPlan } from "@/modules/app/api/plan";
import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Card,
  CardTitle,
  Badge,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@factosys/ui";

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const max = limit ?? 0;
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">
          {used}
          {limit != null ? ` / ${limit}` : ""}
        </span>
      </div>
      {limit != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
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
  });

  const data = planQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inicio"
        description={
          data
            ? `${data.organization_name} · ${data.organization_slug}`
            : "Resumen de plan, uso y accesos rápidos."
        }
      />

      {planQuery.isLoading ? <LoadingState label="Cargando plan…" /> : null}
      {planQuery.error ? (
        <ErrorState
          message={
            planQuery.error instanceof Error ? planQuery.error.message : "No se pudo cargar el plan"
          }
        />
      ) : null}

      {data ? (
        <>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Plan actual</CardTitle>
              {data.org_plan_status ? <Badge variant="muted">{data.org_plan_status}</Badge> : null}
            </div>
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
                label="Empresas"
                used={data.usage.companies}
                limit={data.limits?.max_companies ?? null}
              />
              <UsageBar
                label="Usuarios"
                used={data.usage.users}
                limit={data.limits?.max_users ?? null}
              />
              <UsageBar
                label="Documentos (mes)"
                used={data.usage.documents_this_month}
                limit={data.limits?.max_documents_per_month ?? null}
              />
              <UsageBar
                label="API keys"
                used={data.usage.api_keys}
                limit={data.limits?.max_api_keys ?? null}
              />
            </div>
            <Link to="/app/plan">
              <Button type="button" variant="outline" size="sm">
                <Layers className={buttonIconClassName} />
                <ButtonLabel>Ver plan / solicitar cambio</ButtonLabel>
              </Button>
            </Link>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="space-y-3">
              <Users className="size-6 text-brand-500" />
              <CardTitle>Usuarios</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Invita colaboradores a tu organización.
              </p>
              <Link to="/app/users">
                <Button type="button" size="sm">
                  <ButtonLabel>Gestionar</ButtonLabel>
                </Button>
              </Link>
            </Card>
            <Card className="space-y-3">
              <Building2 className="size-6 text-brand-500" />
              <CardTitle>Empresas</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Configura tus empresas, certificados, credenciales y series.
              </p>
              <Link to="/app/companies">
                <Button type="button" size="sm">
                  <ButtonLabel>Gestionar empresas</ButtonLabel>
                </Button>
              </Link>
            </Card>
            <Card className="space-y-3">
              <KeyRound className="size-6 text-brand-500" />
              <CardTitle>Acceso a la API</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Administra las claves para conectar tus sistemas con la API.
              </p>
              {hasPermission("apikeys:manage") ? (
                <Link to="/app/developers/api-keys">
                  <Button type="button" size="sm" variant="outline">
                    <ButtonLabel>Gestionar API keys</ButtonLabel>
                  </Button>
                </Link>
              ) : null}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
