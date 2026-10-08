import { formatDateTime, statusLabel } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Building2,
  Clock,
  FileText,
  History,
  Inbox,
  KeyRound,
  Layers,
  Send,
  Users,
} from "lucide-react";
import { toast } from "@factosys/ui";

import {
  fetchOrgPlan,
  fetchPlanChangeRequests,
  fetchPublicPlans,
  requestPlanChange,
} from "@/modules/app/api/plan";
import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  EntityCell,
  IconTile,
  Label,
  Select,
  Textarea,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  MutedText,
  PageHeader,
  SectionCard,
} from "@factosys/ui";

function LimitItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800">
      <Icon className="size-4 shrink-0 text-gray-400" aria-hidden />
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="ms-auto font-semibold text-gray-800 dark:text-white/90">
        hasta {value.toLocaleString("es-PE")}
      </span>
    </li>
  );
}

export function AppPlanPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [requestedCode, setRequestedCode] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const planQuery = useQuery({
    queryKey: ["org-plan", user?.organizationId],
    queryFn: fetchOrgPlan,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });
  const catalogQuery = useQuery({
    queryKey: ["public-plans"],
    queryFn: fetchPublicPlans,
  });
  const requestsQuery = useQuery({
    queryKey: ["plan-change-requests"],
    queryFn: fetchPlanChangeRequests,
    refetchInterval: 15_000,
  });

  const mutation = useMutation({
    mutationFn: requestPlanChange,
    onSuccess: () => {
      toast.success("Solicitud enviada al equipo Factosys");
      setMessage("");
      setRequestedCode("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["plan-change-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["org-notifications"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
      else if (err instanceof Error) setFormError(err.message);
      else setFormError("No se pudo enviar la solicitud");
    },
  });

  const plan = planQuery.data;
  const catalog = (catalogQuery.data?.items ?? []).filter((p) => p.code !== plan?.plan?.code);
  const requests = requestsQuery.data?.items ?? [];
  const hasPendingRequest = requests.some(
    (request) => request.status === "pending" || request.status === "acknowledged",
  );

  function submit() {
    setFormError(null);
    if (!requestedCode) {
      setFormError("Selecciona un plan");
      return;
    }
    mutation.mutate({
      requested_plan_code: requestedCode,
      message: message.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers}
        title="Plan"
        description="Consulta tu plan actual y solicita un cambio."
      />

      {planQuery.isLoading ? (
        <LoadingState variant="detail" showHeader={false} label="Cargando plan…" />
      ) : null}
      {planQuery.error ? (
        <ErrorState
          message={
            planQuery.error instanceof Error ? planQuery.error.message : "Error al cargar el plan"
          }
        />
      ) : null}

      {plan ? (
        <SectionCard
          icon={Layers}
          title="Plan actual"
          description={
            plan.org_plan_status ? (
              <StatusBadge
                status={plan.org_plan_status}
                label={statusLabel(plan.org_plan_status)}
              />
            ) : undefined
          }
        >
          {plan.plan ? (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {plan.plan.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {plan.plan.code} · {plan.plan.price_display}
                </p>
              </div>
              {plan.limits ? (
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  <LimitItem icon={Building2} label="Empresas" value={plan.limits.max_companies} />
                  <LimitItem icon={Users} label="Usuarios" value={plan.limits.max_users} />
                  <LimitItem
                    icon={FileText}
                    label="Documentos/mes"
                    value={plan.limits.max_documents_per_month}
                  />
                  <LimitItem icon={KeyRound} label="API keys" value={plan.limits.max_api_keys} />
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">Sin plan asignado.</p>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        icon={ArrowRightLeft}
        title="Solicitar cambio de plan"
        description="Enviaremos la solicitud al equipo de operaciones. No cambia el plan automáticamente."
      >
        {catalogQuery.isLoading ? (
          <LoadingState variant="form" fields={2} label="Cargando planes disponibles…" />
        ) : catalogQuery.error ? (
          <ErrorState
            message="No se pudieron cargar los planes disponibles"
            onRetry={() => void catalogQuery.refetch()}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requested-plan">Plan deseado</Label>
              <Select
                id="requested-plan"
                value={requestedCode}
                onChange={(e) => setRequestedCode(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} ({p.code}) — {p.price_display}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-message">Mensaje (opcional)</Label>
              <Textarea
                id="plan-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Cuéntanos por qué necesitas el cambio…"
              />
            </div>
            {formError ? <FieldError message={formError} /> : null}
            <ActionButton
              size="default"
              variant="primary"
              icon={Send}
              label={mutation.isPending ? "Enviando…" : "Solicitar cambio"}
              pending={mutation.isPending}
              disabled={catalog.length === 0 || hasPendingRequest}
              onClick={submit}
            />
            {hasPendingRequest ? (
              <MutedText className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-warning-500" aria-hidden />
                Tu solicitud está pendiente de revisión. Verás el resultado en el historial y en tus
                notificaciones.
              </MutedText>
            ) : null}
          </div>
        )}
      </SectionCard>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <IconTile icon={History} size="sm" tone="neutral" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Solicitudes recientes
          </h3>
        </div>
        {requestsQuery.isLoading ? (
          <LoadingState variant="table" columns={4} label="Cargando solicitudes…" />
        ) : null}
        {!requestsQuery.isLoading && requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Sin solicitudes"
            description="Cuando pidas un cambio de plan aparecerá aquí."
          />
        ) : null}
        {requests.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Plan solicitado</TH>
                <TH>Actual</TH>
                <TH>Estado</TH>
                <TH>Respuesta</TH>
                <TH>Fecha</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((r) => {
                const [status, label] =
                  r.resolution === "approved"
                    ? ["approved", "Aprobada"]
                    : r.resolution === "rejected"
                      ? ["rejected", "Rechazada"]
                      : r.status === "pending"
                        ? ["pending", "Pendiente"]
                        : r.status === "acknowledged"
                          ? ["acknowledged", "En revisión"]
                          : ["closed", "Cerrada"];
                return (
                  <TR key={r.id}>
                    <TD label="Solicitado">
                      <EntityCell
                        icon={Layers}
                        title={r.requested_plan_name}
                        subtitle={<span className="font-mono">{r.requested_plan_code}</span>}
                      />
                    </TD>
                    <TD label="Actual">
                      <span className="font-mono text-theme-xs">{r.current_plan_code ?? "—"}</span>
                    </TD>
                    <TD label="Estado">
                      <StatusBadge status={status} label={label} />
                    </TD>
                    <TD label="Respuesta">
                      {r.resolution_note ??
                        (r.resolution === "approved" ? "El plan solicitado fue aplicado." : "—")}
                      {r.resolved_at ? (
                        <div className="text-xs text-gray-500">{formatDateTime(r.resolved_at)}</div>
                      ) : null}
                    </TD>
                    <TD label="Fecha">
                      <span className="whitespace-nowrap">{formatDateTime(r.created_at)}</span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        ) : null}
      </section>
    </div>
  );
}
