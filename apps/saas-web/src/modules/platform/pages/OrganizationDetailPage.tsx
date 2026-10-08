import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  ErrorState,
  FieldError,
  LoadingState,
  PageHeader,
  Badge,
  Button,
  Card,
  CardTitle,
  Input,
  Label,
  Select,
} from "@factosys/ui";

import { TextLink } from "@/shared/ui/components/text-link";

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
        title={org?.name ?? "Organización"}
        description="Detalle, suspensión y asignación de plan."
        actions={<TextLink to="/platform/organizations">← Volver al listado</TextLink>}
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
              className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            >
              Organización suspendida — el acceso del tenant debe bloquearse en producto.
            </div>
          ) : null}

          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge color={badge.color}>{badge.label}</Badge>
              {org.slug ? <Badge color="muted">{org.slug}</Badge> : null}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <CardTitle className="mb-1 text-theme-xs text-gray-500">Plan actual</CardTitle>
                <p className="text-sm text-gray-800 dark:text-white/90">
                  {org.current_plan
                    ? `${org.current_plan.plan_name} (${org.current_plan.plan_code}) · ${org.current_plan.status}`
                    : "Sin plan asignado"}
                </p>
              </div>
              <div>
                <CardTitle className="mb-1 text-theme-xs text-gray-500">Creada</CardTitle>
                <p className="text-sm text-gray-800 dark:text-white/90">
                  {new Date(org.created_at).toLocaleString()}
                </p>
              </div>
            </dl>
          </Card>

          {error ? <FieldError message={error} /> : null}

          <Card>
            <CardTitle>Estado</CardTitle>
            <div className="flex flex-wrap gap-2">
              {org.status === "active" ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("suspended")}
                >
                  Suspender
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("active")}
                >
                  Reactivar
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Asignar plan</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
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
              <Button
                type="button"
                disabled={!planId || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                Asignar
              </Button>
            </div>
          </Card>

          {canExport && !org.is_platform ? (
            <Card>
              <CardTitle>Exportar JSON (stub)</CardTitle>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Genera un snapshot asíncrono (org, plan, empresas, usuarios sin secretos) y descarga
                el archivo.
              </p>
              <Button
                type="button"
                data-testid="org-export-json"
                disabled={exportBusy}
                onClick={() => void runExport()}
              >
                {exportBusy ? "Exportando…" : "Exportar JSON"}
              </Button>
            </Card>
          ) : null}

          {canImpersonate && !org.is_platform && org.status === "active" ? (
            <Card>
              <CardTitle>Suplantar (soporte)</CardTitle>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Emite un access token corto con permisos owner del tenant. Requiere motivo
                (auditado).
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="imp-reason">Motivo</Label>
                  <Input
                    id="imp-reason"
                    value={impReason}
                    onChange={(e) => setImpReason(e.target.value)}
                    placeholder="Investigar incidencia de facturación…"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={impersonateMutation.isPending || impReason.trim().length < 3}
                  onClick={() => impersonateMutation.mutate()}
                >
                  Suplantar
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
