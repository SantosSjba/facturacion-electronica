import { formatDateTime, statusLabel } from "@/shared/ui/display-labels";
import { UsersManager } from "@/modules/app/components/UsersManager";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  AtSign,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  Download,
  Layers,
  LogIn,
  PauseCircle,
  PlayCircle,
  Power,
  UserCog,
} from "lucide-react";
import { toast } from "@factosys/ui";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { BackLink } from "@/shared/ui/components/action-link";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  ActionButton,
  Badge,
  Card,
  ErrorState,
  FieldError,
  Input,
  Label,
  LoadingState,
  MutedText,
  PageHeader,
  SectionCard,
  Select,
  StatCard,
} from "@factosys/ui";

import {
  assignOrgPlan,
  downloadOrgExport,
  fetchOrganization,
  fetchOrgExport,
  impersonateOrganization,
  patchOrganization,
  requestOrgExport,
} from "../api/orgs";
import { fetchAdminPlans } from "../api/plans";
import { orgStatusBadge } from "../lib/status-badges";

export function OrganizationDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { hasPermission, adoptImpersonationToken } = useSession();
  const canImpersonate = hasPermission("platform:admin");
  const canExport = hasPermission("platform:ops");
  const qc = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [impReason, setImpReason] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

  const query = useQuery({
    queryKey: ["organization", id],
    queryFn: () => fetchOrganization(id),
    enabled: Boolean(id),
  });

  const plansQuery = useQuery({
    queryKey: ["platform", "plans"],
    queryFn: fetchAdminPlans,
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "suspended") => patchOrganization(id, { status }),
    onSuccess: async () => {
      toast.success("Estado actualizado");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["organization", id] });
      await qc.invalidateQueries({ queryKey: ["organizations"] });
      await qc.invalidateQueries({ queryKey: ["platform", "stats"] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Error",
      );
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignOrgPlan({
        organization_id: id,
        plan_id: planId,
        status: "active",
      }),
    onSuccess: async () => {
      toast.success("Plan asignado");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["organization", id] });
      await qc.invalidateQueries({ queryKey: ["organizations"] });
      await qc.invalidateQueries({ queryKey: ["platform", "plan-change-requests"] });
      await qc.invalidateQueries({ queryKey: ["org-plan", id] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al asignar plan",
      );
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: () =>
      impersonateOrganization({
        organization_id: id,
        reason: impReason.trim(),
        ttl_minutes: 15,
      }),
    onSuccess: (res) => {
      toast.success(`Suplantando ${res.organization_name}`);
      adoptImpersonationToken(res.access_token);
      navigate("/app", { replace: true });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo suplantar",
      );
    },
  });

  async function runExport(): Promise<void> {
    setExportBusy(true);
    setError(null);
    try {
      const ticket = await requestOrgExport(id);
      let status = ticket.status;
      let exportId = ticket.id;
      for (let i = 0; i < 40 && status !== "ready" && status !== "failed"; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const next = await fetchOrgExport(id, exportId);
        status = next.status;
        exportId = next.id;
        if (status === "failed") {
          throw new Error(next.error ?? "Export failed");
        }
      }
      if (status !== "ready") {
        throw new Error("Export timed out");
      }
      const blob = await downloadOrgExport(id, exportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `org-export-${id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportación descargada");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo exportar",
      );
    } finally {
      setExportBusy(false);
    }
  }

  const org = query.data;
  const badge = org ? orgStatusBadge(org.status) : null;
  const activePlans = (plansQuery.data?.items ?? []).filter((p) => p.active);

  return (
    <div>
      <PageHeader
        icon={Building2}
        title={org?.name ?? "Organización"}
        description="Detalle, suspensión y asignación de plan."
        meta={
          org && badge ? (
            <>
              <StatusBadge status={org.status} label={badge.label} />
              {org.slug ? (
                <Badge color="muted">
                  <AtSign className="size-3 shrink-0" aria-hidden />
                  {org.slug}
                </Badge>
              ) : null}
            </>
          ) : null
        }
        actions={<BackLink to="/platform/organizations" />}
      />

      {query.isLoading ? (
        <LoadingState variant="detail" showHeader={false} label="Cargando…" />
      ) : null}
      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "No se pudo cargar"}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {org && badge ? (
        <div className="space-y-4">
          {org.status === "suspended" ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Organización suspendida — el acceso del tenant debe bloquearse en producto.
            </div>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Layers}
              tone={org.current_plan ? "brand" : "muted"}
              label="Plan actual"
              value={org.current_plan?.plan_name ?? "Sin plan asignado"}
              hint={
                org.current_plan
                  ? `${org.current_plan.plan_code} · ${statusLabel(org.current_plan.status)}`
                  : undefined
              }
            />
            <StatCard icon={CalendarPlus} label="Creada" value={formatDateTime(org.created_at)} />
            <StatCard
              icon={CalendarClock}
              label="Actualizada"
              value={formatDateTime(org.updated_at)}
            />
          </section>

          {error ? <FieldError message={error} /> : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              icon={Power}
              tone={org.status === "active" ? "success" : "error"}
              title="Estado"
              description={
                org.status === "active"
                  ? "Suspender bloquea el acceso del tenant hasta reactivarlo."
                  : "Reactivar devuelve el acceso al tenant."
              }
            >
              {org.status === "active" ? (
                <ActionButton
                  size="sm"
                  variant="destructive"
                  icon={PauseCircle}
                  label="Suspender"
                  pending={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("suspended")}
                />
              ) : (
                <ActionButton
                  size="sm"
                  variant="primary"
                  icon={PlayCircle}
                  label="Reactivar"
                  pending={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("active")}
                />
              )}
            </SectionCard>

            <SectionCard
              icon={Layers}
              title="Asignar plan"
              description="Aplica un plan activo del catálogo a la organización."
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="plan">Plan activo</Label>
                  <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {activePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — {p.price_display}
                      </option>
                    ))}
                  </Select>
                </div>
                <ActionButton
                  size="default"
                  variant="primary"
                  icon={Check}
                  label="Asignar"
                  disabled={!planId}
                  pending={assignMutation.isPending}
                  onClick={() => assignMutation.mutate()}
                />
              </div>
            </SectionCard>

            {canExport && !org.is_platform ? (
              <SectionCard
                icon={Download}
                tone="neutral"
                title="Exportar JSON (stub)"
                description="Genera un snapshot asíncrono (org, plan, empresas, usuarios sin secretos) y descarga el archivo."
              >
                <ActionButton
                  size="sm"
                  variant="outline"
                  icon={Download}
                  label={exportBusy ? "Exportando…" : "Exportar JSON"}
                  data-testid="org-export-json"
                  pending={exportBusy}
                  onClick={() => void runExport()}
                />
              </SectionCard>
            ) : null}

            {canImpersonate && !org.is_platform && org.status === "active" ? (
              <SectionCard
                icon={UserCog}
                tone="warning"
                title="Suplantar (soporte)"
                description="Emite un access token corto con permisos owner del tenant. Requiere motivo (auditado)."
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="imp-reason">Motivo</Label>
                    <Input
                      id="imp-reason"
                      value={impReason}
                      onChange={(e) => setImpReason(e.target.value)}
                      placeholder="Investigar incidencia de facturación…"
                    />
                  </div>
                  <ActionButton
                    size="default"
                    variant="destructive"
                    icon={LogIn}
                    label="Suplantar"
                    disabled={impReason.trim().length < 3}
                    pending={impersonateMutation.isPending}
                    onClick={() => impersonateMutation.mutate()}
                  />
                </div>
              </SectionCard>
            ) : null}
          </section>

          {canImpersonate && !org.is_platform ? (
            <Card>
              <UsersManager organizationId={id} />
            </Card>
          ) : null}

          {org.is_platform ? (
            <MutedText>
              La organización de plataforma no admite exportación ni suplantación.
            </MutedText>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
