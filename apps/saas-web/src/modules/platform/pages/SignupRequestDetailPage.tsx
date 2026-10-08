import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Hash,
  Layers,
  ListChecks,
  Mail,
  Search,
  StickyNote,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "@factosys/ui";

import { ApiError } from "@/shared/api/errors";
import { BackLink } from "@/shared/ui/components/action-link";
import { formatDateTime } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  ActionButton,
  Badge,
  ErrorState,
  FieldError,
  InfoField,
  InfoGrid,
  LoadingState,
  MutedText,
  PageHeader,
  SectionCard,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Label,
  Textarea,
  textLinkClassName,
} from "@factosys/ui";

import { fetchSignupRequest, patchSignupRequest, type SignupStatus } from "../api/signups";
import { signupStatusBadge } from "../lib/status-badges";

export function SignupRequestDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["signup-request", id],
    queryFn: () => fetchSignupRequest(id),
    enabled: Boolean(id),
  });

  const mutation = useMutation({
    mutationFn: (body: { status?: SignupStatus; notes?: string | null }) =>
      patchSignupRequest(id, body),
    onSuccess: async () => {
      toast.success("Solicitud actualizada");
      setActionError(null);
      setRejectOpen(false);
      await qc.invalidateQueries({ queryKey: ["signup-request", id] });
      await qc.invalidateQueries({ queryKey: ["signup-requests"] });
      await qc.invalidateQueries({ queryKey: ["platform", "stats"] });
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al actualizar",
      );
    },
  });

  const item = query.data;
  const badge = item ? signupStatusBadge(item.status) : null;

  function openReject() {
    setRejectNotes("");
    setRejectOpen(true);
  }

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title={item?.company_name ?? "Solicitud"}
        description="Detalle y acciones de aprobación / rechazo."
        meta={
          item && badge ? (
            <>
              <StatusBadge status={item.status} label={badge.label} />
              {item.plan_code ? (
                <Badge color="muted">
                  <Layers className="size-3 shrink-0" aria-hidden />
                  Plan: {item.plan_code}
                </Badge>
              ) : null}
            </>
          ) : null
        }
        actions={<BackLink to="/platform/signup-requests" />}
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

      {item && badge ? (
        <div className="space-y-4">
          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard icon={Building2} title="Empresa">
              <InfoGrid>
                <InfoField icon={Hash} label="RUC" value={item.ruc} mono />
                <InfoField icon={Layers} label="Plan solicitado" value={item.plan_code} />
                <InfoField
                  icon={CalendarPlus}
                  label="Creada"
                  value={formatDateTime(item.created_at)}
                />
                <InfoField
                  icon={CalendarClock}
                  label="Actualizada"
                  value={formatDateTime(item.updated_at)}
                />
              </InfoGrid>
            </SectionCard>

            <SectionCard icon={UserRound} tone="neutral" title="Contacto">
              <InfoGrid>
                <InfoField icon={UserRound} label="Contacto" value={item.contact_name} />
                <InfoField
                  icon={Mail}
                  label="Email"
                  value={
                    <a className={textLinkClassName} href={`mailto:${item.contact_email}`}>
                      {item.contact_email}
                    </a>
                  }
                />
              </InfoGrid>
            </SectionCard>
          </section>

          <SectionCard icon={StickyNote} tone="neutral" title="Notas">
            <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-white/90">
              {item.notes ?? "—"}
            </p>
          </SectionCard>

          {actionError ? <FieldError message={actionError} /> : null}

          <SectionCard
            icon={ListChecks}
            tone={
              item.status === "approved"
                ? "success"
                : item.status === "rejected"
                  ? "error"
                  : "brand"
            }
            title="Acciones"
            description={
              item.status === "received"
                ? "Marca la solicitud en revisión antes de aprobarla."
                : item.status === "under_review"
                  ? "Aprueba para crear la organización o rechaza indicando el motivo."
                  : undefined
            }
          >
            <div className="flex flex-wrap gap-2">
              {item.status === "received" ? (
                <>
                  <ActionButton
                    size="sm"
                    variant="primary"
                    icon={Search}
                    label="Marcar en revisión"
                    data-testid="signup-mark-review"
                    pending={mutation.isPending}
                    onClick={() => mutation.mutate({ status: "under_review" })}
                  />
                  <ActionButton
                    size="sm"
                    variant="destructive"
                    icon={XCircle}
                    label="Rechazar"
                    data-testid="signup-reject"
                    disabled={mutation.isPending}
                    onClick={openReject}
                  />
                </>
              ) : null}
              {item.status === "under_review" ? (
                <>
                  <ActionButton
                    size="sm"
                    variant="primary"
                    icon={CheckCircle2}
                    label="Aprobar"
                    data-testid="signup-approve"
                    pending={mutation.isPending}
                    onClick={() => mutation.mutate({ status: "approved" })}
                  />
                  <ActionButton
                    size="sm"
                    variant="destructive"
                    icon={XCircle}
                    label="Rechazar"
                    data-testid="signup-reject"
                    disabled={mutation.isPending}
                    onClick={openReject}
                  />
                </>
              ) : null}
              {item.status === "approved" ? (
                <p
                  className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                  data-testid="signup-approved"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-success-500" aria-hidden />
                  Aprobada
                  {item.organization_id ? (
                    <>
                      {" "}
                      — org{" "}
                      <Link
                        className="font-mono text-brand-500 hover:underline"
                        data-testid="signup-org-id"
                        to={`/platform/organizations/${item.organization_id}`}
                      >
                        {item.organization_id}
                      </Link>
                    </>
                  ) : (
                    <>
                      .{" "}
                      <Link className="text-brand-500 hover:underline" to="/platform/organizations">
                        Ver organizaciones
                      </Link>
                    </>
                  )}
                </p>
              ) : null}
              {item.status === "rejected" ? (
                <MutedText className="flex items-center gap-1.5">
                  <XCircle className="size-4 shrink-0 text-error-500" aria-hidden />
                  Solicitud rechazada. El motivo queda registrado en las notas.
                </MutedText>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        ariaLabel="Rechazar solicitud"
        size="md"
      >
        <DialogHeader title="Rechazar solicitud" onClose={() => setRejectOpen(false)} />
        <DialogBody className="space-y-1.5">
          <Label htmlFor="reject-notes">Motivo</Label>
          <Textarea
            id="reject-notes"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={4}
            placeholder="Motivo visible en notes…"
          />
        </DialogBody>
        <DialogFooter>
          <ActionButton
            size="default"
            icon={X}
            label="Cancelar"
            onClick={() => setRejectOpen(false)}
          />
          <ActionButton
            size="default"
            variant="destructive"
            icon={XCircle}
            label="Confirmar rechazo"
            disabled={!rejectNotes.trim()}
            pending={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                status: "rejected",
                notes: rejectNotes.trim(),
              })
            }
          />
        </DialogFooter>
      </Dialog>
    </div>
  );
}
