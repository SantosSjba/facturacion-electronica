import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, RefreshCw, Webhook } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Input,
  Label,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@factosys/ui";

import { fetchWebhooks, patchWebhook, rotateWebhookSecret } from "../api";
import { CreateWebhookDialog } from "../components/CreateWebhookDialog";
import { EditWebhookDialog } from "../components/EditWebhookDialog";
import { WebhooksTable, type WebhookPendingAction } from "../components/WebhooksTable";
import type { WebhookEndpoint } from "../types";

export function WebhooksListPage() {
  const { hasPermission } = useSession();
  const canManage = hasPermission("webhooks:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState<WebhookEndpoint | null>(null);
  const [rotateTarget, setRotateTarget] = useState<WebhookEndpoint | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      patchWebhook(id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["webhooks"] });
      setActionError(null);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo actualizar",
      );
    },
  });

  const rotateMutation = useMutation({
    mutationFn: rotateWebhookSecret,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["webhooks"] });
      setRotateTarget(null);
      setRotatedSecret(result.secret);
      setCopied(false);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo rotar el secret",
      );
    },
  });

  const pending: WebhookPendingAction =
    patchMutation.isPending && patchMutation.variables
      ? { id: patchMutation.variables.id, action: "toggle" }
      : rotateMutation.isPending && rotateMutation.variables
        ? { id: rotateMutation.variables, action: "rotate" }
        : null;

  const createButton = canManage ? (
    <ActionButton
      variant="primary"
      icon={Plus}
      label="Nuevo webhook"
      onClick={() => setCreateOpen(true)}
    />
  ) : null;

  function onToggleStatus(ep: WebhookEndpoint) {
    const next = ep.status === "active" ? "disabled" : "active";
    patchMutation.mutate({ id: ep.id, status: next });
  }

  return (
    <div>
      <PageHeader
        icon={Webhook}
        title="Webhooks"
        description="Suscripciones a eventos. Desactiva con PATCH; no hay DELETE."
        actions={createButton}
      />

      {actionError ? (
        <div className="mb-4">
          <ErrorState message={actionError} />
        </div>
      ) : null}

      {query.isLoading ? <LoadingState variant="table" label="Cargando webhooks…" /> : null}

      {!query.isLoading && query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Error al cargar webhooks"}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Webhook}
            title="Sin webhooks"
            description="Crea un endpoint HTTPS para recibir document.status_changed."
            action={createButton ?? undefined}
          />
        ) : (
          <WebhooksTable
            endpoints={query.data ?? []}
            canManage={canManage}
            onRotate={setRotateTarget}
            onToggleStatus={onToggleStatus}
            onEdit={setEditEndpoint}
            pending={pending}
          />
        )
      ) : null}

      <CreateWebhookDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditWebhookDialog endpoint={editEndpoint} onClose={() => setEditEndpoint(null)} />

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        title="Rotar secret"
        description="Se generará un nuevo secret; el actual dejará de validar las firmas de inmediato."
        confirmLabel="Rotar secret"
        confirmIcon={RefreshCw}
        pending={rotateMutation.isPending}
        onConfirm={() => {
          if (rotateTarget) rotateMutation.mutate(rotateTarget.id);
        }}
        onClose={() => setRotateTarget(null)}
      >
        {rotateTarget ? (
          <p className="break-all font-mono text-theme-xs text-gray-700 dark:text-gray-300">
            {rotateTarget.url}
          </p>
        ) : null}
      </ConfirmDialog>

      <Dialog
        open={Boolean(rotatedSecret)}
        onClose={() => setRotatedSecret(null)}
        ariaLabel="Secret rotado"
        closeOnBackdrop={false}
      >
        <DialogHeader
          title="Secret rotado"
          description="Copia el nuevo secret ahora."
          onClose={() => setRotatedSecret(null)}
        />
        <DialogBody className="space-y-3">
          <div className="space-y-1.5">
            <Label>Secret</Label>
            <div className="flex gap-2">
              <Input readOnly value={rotatedSecret ?? ""} className="font-mono text-theme-xs" />
              <ActionButton
                size="icon"
                className="size-11 shrink-0"
                icon={copied ? Check : Copy}
                label={copied ? "Copiado" : "Copiar secret"}
                onClick={() => {
                  if (!rotatedSecret) return;
                  void navigator.clipboard.writeText(rotatedSecret).then(() => {
                    setCopied(true);
                  });
                }}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <ActionButton
            size="default"
            variant="primary"
            icon={Check}
            label="Entendido"
            onClick={() => setRotatedSecret(null)}
          />
        </DialogFooter>
      </Dialog>
    </div>
  );
}
