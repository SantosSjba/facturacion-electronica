import { useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { Label } from "@/shared/ui/components/label";
import { Textarea } from "@/shared/ui/components/textarea";
import { TextLink } from "@/shared/ui/components/text-link";

import {
  fetchSignupRequest,
  patchSignupRequest,
  type SignupStatus,
} from "../api/signups";
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

  return (
    <div>
      <PageHeader
        title={item?.company_name ?? "Solicitud"}
        description="Detalle y acciones de aprobación / rechazo."
        actions={
          <TextLink to="/platform/signup-requests">← Volver al listado</TextLink>
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

      {item && badge ? (
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge color={badge.color}>{badge.label}</Badge>
              {item.plan_code ? (
                <Badge color="muted">Plan: {item.plan_code}</Badge>
              ) : null}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="RUC" value={item.ruc} />
              <Field label="Contacto" value={item.contact_name} />
              <Field label="Email" value={item.contact_email} />
              <Field
                label="Creada"
                value={new Date(item.created_at).toLocaleString()}
              />
              <div className="sm:col-span-2">
                <Field label="Notas" value={item.notes ?? "—"} />
              </div>
            </dl>
          </Card>

          {actionError ? <FieldError message={actionError} /> : null}

          <div className="flex flex-wrap gap-2">
            {item.status === "received" ? (
              <>
                <Button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ status: "under_review" })
                  }
                >
                  Marcar en revisión
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setRejectNotes("");
                    setRejectOpen(true);
                  }}
                >
                  Rechazar
                </Button>
              </>
            ) : null}
            {item.status === "under_review" ? (
              <>
                <Button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ status: "approved" })}
                >
                  Aprobar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setRejectNotes("");
                    setRejectOpen(true);
                  }}
                >
                  Rechazar
                </Button>
              </>
            ) : null}
            {item.status === "approved" ? (
              <p className="text-sm text-gray-500">
                Aprobada
                {item.organization_id ? (
                  <>
                    {" "}
                    — org{" "}
                    <Link
                      className="font-mono text-brand-500 hover:underline"
                      to={`/platform/organizations/${item.organization_id}`}
                    >
                      {item.organization_id}
                    </Link>
                  </>
                ) : (
                  <>
                    .{" "}
                    <Link
                      className="text-brand-500 hover:underline"
                      to="/platform/organizations"
                    >
                      Ver organizaciones
                    </Link>
                  </>
                )}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        ariaLabel="Rechazar solicitud"
        size="md"
      >
        <DialogHeader title="Rechazar solicitud" onClose={() => setRejectOpen(false)} />
        <DialogBody>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejectOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending || !rejectNotes.trim()}
            onClick={() =>
              mutation.mutate({
                status: "rejected",
                notes: rejectNotes.trim(),
              })
            }
          >
            Confirmar rechazo
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <CardTitle className="mb-1 text-theme-xs font-medium text-gray-500">
        {label}
      </CardTitle>
      <p className="text-sm text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
