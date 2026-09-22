import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

import {
  fetchWebhooks,
  patchWebhook,
  rotateWebhookSecret,
} from "../api";
import { CreateWebhookDialog } from "../components/CreateWebhookDialog";
import { DeliveriesPanel } from "../components/DeliveriesPanel";
import { WebhooksTable } from "../components/WebhooksTable";
import type { WebhookEndpoint } from "../types";

export function WebhooksListPage() {
  const { hasPermission } = useSession();
  const canManage = hasPermission("webhooks:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  const patchMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "disabled";
    }) => patchWebhook(id, { status }),
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

  const pendingId =
    patchMutation.isPending
      ? patchMutation.variables?.id
      : rotateMutation.isPending
        ? (rotateMutation.variables as string | undefined)
        : null;

  function onToggleStatus(ep: WebhookEndpoint) {
    const next = ep.status === "active" ? "disabled" : "active";
    patchMutation.mutate({ id: ep.id, status: next });
  }

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Suscripciones a eventos. Desactiva con PATCH; no hay DELETE."
        actions={
          canManage ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Nuevo webhook
            </Button>
          ) : null
        }
      />

      {actionError ? (
        <div className="mb-4">
          <ErrorState message={actionError} />
        </div>
      ) : null}

      {query.isLoading ? <LoadingState label="Cargando webhooks…" /> : null}

      {!query.isLoading && query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Error al cargar webhooks"
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Sin webhooks"
            description="Crea un endpoint HTTPS para recibir document.status_changed."
            action={
              canManage ? (
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  Nuevo webhook
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            <WebhooksTable
              endpoints={query.data ?? []}
              canManage={canManage}
              expandedId={expandedId}
              onToggleExpand={(id) =>
                setExpandedId((cur) => (cur === id ? null : id))
              }
              onRotate={(id) => {
                if (window.confirm("¿Rotar el secret de este webhook?")) {
                  rotateMutation.mutate(id);
                }
              }}
              onToggleStatus={onToggleStatus}
              pendingId={pendingId}
            />
            {expandedId ? <DeliveriesPanel endpointId={expandedId} /> : null}
          </div>
        )
      ) : null}

      <CreateWebhookDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

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
              <Input
                readOnly
                value={rotatedSecret ?? ""}
                className="font-mono text-theme-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!rotatedSecret) return;
                  void navigator.clipboard.writeText(rotatedSecret).then(() => {
                    setCopied(true);
                  });
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => setRotatedSecret(null)}>
            Entendido
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
