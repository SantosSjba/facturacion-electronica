import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  Badge,
  Button,
  DEFAULT_PAGE_SIZE,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  ErrorState,
  FieldError,
  Label,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  toast,
} from "@factosys/ui";
import { ApiError, getErrorMessage } from "@/shared/api/errors";
import { TextLink } from "@/shared/ui/components/text-link";
import {
  fetchPlatformPlanChangeRequests,
  resolvePlanChangeRequest,
  type PlanChangeStatus,
  type PlatformPlanChangeRequest,
} from "../api/plan-change-requests";

function RequestStatus({ request }: { request: PlatformPlanChangeRequest }) {
  const label =
    request.resolution === "approved"
      ? "Aprobada"
      : request.resolution === "rejected"
        ? "Rechazada"
        : request.status === "pending"
          ? "Pendiente"
          : request.status === "acknowledged"
            ? "En revisión"
            : "Cerrada";
  return (
    <Badge
      color={
        request.resolution === "approved"
          ? "success"
          : request.resolution === "rejected"
            ? "error"
            : request.status === "pending"
              ? "warning"
              : "info"
      }
    >
      {label}
    </Badge>
  );
}

export function PlanChangeRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PlanChangeStatus | "">("pending");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<PlatformPlanChangeRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["platform", "plan-change-requests", status, page, pageSize],
    queryFn: () => fetchPlatformPlanChangeRequests({ status: status || undefined, page, pageSize }),
    refetchInterval: 30_000,
  });
  const mutation = useMutation({
    mutationFn: (input: { id: string; decision: "approve" | "reject"; note?: string }) =>
      resolvePlanChangeRequest(input.id, { decision: input.decision, note: input.note }),
    onSuccess: async (_, input) => {
      toast.success(
        input.decision === "approve"
          ? "Cambio aprobado y plan aplicado"
          : "Solicitud rechazada. El plan se mantiene.",
      );
      setSelected(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["platform", "plan-change-requests"] }),
        qc.invalidateQueries({ queryKey: ["organization"] }),
        qc.invalidateQueries({ queryKey: ["organizations"] }),
        qc.invalidateQueries({ queryKey: ["platform", "stats"] }),
      ]);
    },
    onError: (error) => {
      toast.error("No se pudo resolver la solicitud", { description: getErrorMessage(error) });
      if (error instanceof ApiError && error.status === 409) setSelected(null);
      void query.refetch();
    },
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const closed = selected?.status === "closed";
  function openReview(request: PlatformPlanChangeRequest) {
    setSelected(request);
    setDecision("approve");
    setNote("");
    setNoteError(null);
  }
  function submit() {
    if (!selected || mutation.isPending) return;
    if (decision === "reject" && !note.trim()) {
      setNoteError("Indica el motivo del rechazo para informar al cliente.");
      return;
    }
    mutation.mutate({ id: selected.id, decision, note: note.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cambios de plan"
        description="Revisa las solicitudes y responde al cliente. Aprobar aplica el plan y cierra la solicitud en un solo paso."
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-64">
          <Label htmlFor="plan-change-status">Estado</Label>
          <Select
            id="plan-change-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PlanChangeStatus | "");
              setPage(1);
            }}
          >
            <option value="">Todas las solicitudes</option>
            <option value="pending">Pendientes</option>
            <option value="acknowledged">En revisión</option>
            <option value="closed">Resueltas</option>
          </Select>
        </div>
        <Button variant="outline" loading={query.isFetching} onClick={() => void query.refetch()}>
          Actualizar
        </Button>
      </div>
      {query.isLoading ? (
        <LoadingState variant="table" label="Cargando solicitudes de cambio de plan…" />
      ) : query.error ? (
        <ErrorState
          message="No se pudieron cargar las solicitudes de cambio de plan."
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin solicitudes de cambio de plan"
          description={
            status === "pending"
              ? "Estás al día. No hay solicitudes pendientes por revisar."
              : "No hay solicitudes con este estado."
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Organización y solicitante</TH>
                <TH>Cambio solicitado</TH>
                <TH>Estado</TH>
                <TH>Fecha</TH>
                <TH>Acciones</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((request) => (
                <TR key={request.id}>
                  <TD label="Organización">
                    <div className="font-medium">{request.organization_name}</div>
                    <div className="break-all text-xs text-gray-500">
                      {request.requested_by_email}
                    </div>
                  </TD>
                  <TD label="Cambio">
                    <div className="flex flex-wrap items-center justify-end gap-2 md:justify-start">
                      <span className="text-gray-500">
                        {request.current_plan_name ?? "Sin plan"}
                      </span>
                      <ArrowRight size={16} aria-hidden="true" />
                      <span className="font-medium">{request.requested_plan_name}</span>
                    </div>
                  </TD>
                  <TD label="Estado">
                    <RequestStatus request={request} />
                  </TD>
                  <TD label="Fecha">{new Date(request.created_at).toLocaleString("es-PE")}</TD>
                  <TD actions>
                    <Button
                      variant={request.status === "closed" ? "outline" : "primary"}
                      size="sm"
                      onClick={() => openReview(request)}
                    >
                      {request.status === "closed" ? "Ver resultado" : "Revisar solicitud"}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / pageSize))}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!mutation.isPending) setSelected(null);
        }}
        ariaLabel="Revisar cambio de plan"
        size="lg"
        closeOnBackdrop={!mutation.isPending}
        closeOnEscape={!mutation.isPending}
      >
        {selected ? (
          <>
            <DialogHeader
              title={closed ? "Resultado del cambio de plan" : "Revisar cambio de plan"}
              description={selected.organization_name}
            />
            <DialogBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-white/5">
                <div>
                  <p className="text-xs text-gray-500">Plan al solicitar</p>
                  <p>{selected.current_plan_name ?? "Sin plan"}</p>
                </div>
                <ArrowRight aria-hidden="true" />
                <div>
                  <p className="text-xs text-gray-500">Plan solicitado</p>
                  <p className="font-semibold">{selected.requested_plan_name}</p>
                </div>
                <RequestStatus request={selected} />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Enviada por {selected.requested_by_email} ·{" "}
                  {new Date(selected.created_at).toLocaleString("es-PE")}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {selected.message ?? "El cliente no adjuntó un mensaje."}
                </p>
              </div>
              {closed ? (
                <div>
                  <p className="font-medium">Respuesta al cliente</p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {selected.resolution_note ??
                      (selected.resolution === "approved"
                        ? "El plan solicitado fue aplicado."
                        : "Sin observaciones.")}
                  </p>
                  {selected.resolved_at ? (
                    <p className="mt-2 text-sm text-gray-500">
                      Resuelta el {new Date(selected.resolved_at).toLocaleString("es-PE")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="plan-decision">Decisión</Label>
                    <Select
                      id="plan-decision"
                      value={decision}
                      disabled={mutation.isPending}
                      onChange={(event) => {
                        setDecision(event.target.value as "approve" | "reject");
                        setNoteError(null);
                      }}
                    >
                      <option value="approve">Aprobar y aplicar el plan</option>
                      <option value="reject">Rechazar la solicitud</option>
                    </Select>
                  </div>
                  <p className="text-sm text-gray-500">
                    {decision === "approve"
                      ? "Se activará el plan solicitado, se cerrará esta solicitud y se notificará al cliente."
                      : "El plan actual se mantendrá. El cliente recibirá el motivo del rechazo y podrá enviar una nueva solicitud."}
                  </p>
                  <div>
                    <Label htmlFor="resolution-note">
                      {decision === "reject"
                        ? "Motivo del rechazo"
                        : "Respuesta al cliente (opcional)"}
                    </Label>
                    <Textarea
                      id="resolution-note"
                      value={note}
                      maxLength={2000}
                      rows={3}
                      disabled={mutation.isPending}
                      onChange={(event) => {
                        setNote(event.target.value);
                        setNoteError(null);
                      }}
                    />
                    {noteError ? <FieldError message={noteError} /> : null}
                  </div>
                </>
              )}
              <TextLink to={"/platform/organizations/" + selected.organization_id}>
                Ver organización
              </TextLink>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setSelected(null)}
              >
                {closed ? "Cerrar" : "Cancelar"}
              </Button>
              {!closed ? (
                <Button
                  variant={decision === "reject" ? "destructive" : "primary"}
                  loading={mutation.isPending}
                  onClick={submit}
                >
                  {decision === "approve" ? "Aprobar y aplicar" : "Confirmar rechazo"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
