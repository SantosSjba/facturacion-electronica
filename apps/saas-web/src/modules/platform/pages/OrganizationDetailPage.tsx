import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/errors";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { TextLink } from "@/shared/ui/components/text-link";

import {
  assignOrgPlan,
  fetchOrganization,
  patchOrganization,
} from "../api/orgs";
import { fetchAdminPlans } from "../api/plans";
import { orgStatusBadge } from "../lib/status-badges";

export function OrganizationDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    mutationFn: (status: "active" | "suspended") =>
      patchOrganization(id, { status }),
    onSuccess: async () => {
      toast.success("Estado actualizado");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["organization", id] });
      await qc.invalidateQueries({ queryKey: ["organizations"] });
      await qc.invalidateQueries({ queryKey: ["platform", "stats"] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error",
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

  const org = query.data;
  const badge = org ? orgStatusBadge(org.status) : null;
  const activePlans = (plansQuery.data?.items ?? []).filter((p) => p.active);

  return (
    <div>
      <PageHeader
        title={org?.name ?? "Organización"}
        description="Detalle, suspensión y asignación de plan."
        actions={
          <TextLink to="/platform/organizations">← Volver al listado</TextLink>
        }
      />

      {query.isLoading ? <LoadingState label="Cargando…" /> : null}
      {query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "No se pudo cargar"
          }
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
              Organización suspendida — el acceso del tenant debe bloquearse en
              producto.
            </div>
          ) : null}

          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge color={badge.color}>{badge.label}</Badge>
              {org.slug ? <Badge color="muted">{org.slug}</Badge> : null}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <CardTitle className="mb-1 text-theme-xs text-gray-500">
                  Plan actual
                </CardTitle>
                <p className="text-sm text-gray-800 dark:text-white/90">
                  {org.current_plan
                    ? `${org.current_plan.plan_name} (${org.current_plan.plan_code}) · ${org.current_plan.status}`
                    : "Sin plan asignado"}
                </p>
              </div>
              <div>
                <CardTitle className="mb-1 text-theme-xs text-gray-500">
                  Creada
                </CardTitle>
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
                <Select
                  id="plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
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
        </div>
      ) : null}
    </div>
  );
}
