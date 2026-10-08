import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  fetchOrgPlan,
  fetchPlanChangeRequests,
  fetchPublicPlans,
  requestPlanChange,
} from "@/modules/app/api/plan";
import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  Badge,
  Card,
  CardTitle,
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
  PageHeader,
} from "@factosys/ui";

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
  });
  const catalogQuery = useQuery({
    queryKey: ["public-plans"],
    queryFn: fetchPublicPlans,
  });
  const requestsQuery = useQuery({
    queryKey: ["plan-change-requests"],
    queryFn: fetchPlanChangeRequests,
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
      <PageHeader title="Plan" description="Consulta tu plan actual y solicita un cambio." />

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
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Plan actual</CardTitle>
            {plan.org_plan_status ? <Badge variant="muted">{plan.org_plan_status}</Badge> : null}
          </div>
          {plan.plan ? (
            <>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {plan.plan.name}
              </p>
              <p className="text-sm text-gray-500">
                {plan.plan.code} · {plan.plan.price_display}
              </p>
              {plan.limits ? (
                <ul className="grid gap-1 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                  <li>Empresas: hasta {plan.limits.max_companies}</li>
                  <li>Usuarios: hasta {plan.limits.max_users}</li>
                  <li>Documentos/mes: hasta {plan.limits.max_documents_per_month}</li>
                  <li>API keys: hasta {plan.limits.max_api_keys}</li>
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">Sin plan asignado.</p>
          )}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <CardTitle>Solicitar cambio de plan</CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Enviaremos la solicitud al equipo de operaciones. No cambia el plan automáticamente.
        </p>
        {catalogQuery.isLoading ? (
          <LoadingState variant="form" fields={2} label="Cargando planes disponibles…" />
        ) : catalogQuery.error ? (
          <ErrorState
            message="No se pudieron cargar los planes disponibles"
            onRetry={() => void catalogQuery.refetch()}
          />
        ) : (
          <>
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
            <Button
              type="button"
              onClick={submit}
              loading={mutation.isPending}
              disabled={mutation.isPending || catalog.length === 0}
            >
              <ButtonLabel>{mutation.isPending ? "Enviando…" : "Solicitar cambio"}</ButtonLabel>
            </Button>
          </>
        )}
      </Card>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          Solicitudes recientes
        </h3>
        {requestsQuery.isLoading ? (
          <LoadingState variant="table" columns={4} label="Cargando solicitudes…" />
        ) : null}
        {!requestsQuery.isLoading && requests.length === 0 ? (
          <EmptyState
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
                <TH>Fecha</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id}>
                  <TD label="Solicitado">
                    {r.requested_plan_name} ({r.requested_plan_code})
                  </TD>
                  <TD label="Actual">{r.current_plan_code ?? "—"}</TD>
                  <TD label="Estado">
                    <Badge variant="outline">{r.status}</Badge>
                  </TD>
                  <TD label="Fecha">{new Date(r.created_at).toLocaleString()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : null}
      </div>
    </div>
  );
}
