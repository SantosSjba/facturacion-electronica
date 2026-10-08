import { formatDateTime, statusLabel } from "@/shared/ui/display-labels";
import { ActionLink } from "@/shared/ui/components/action-link";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Lock,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Webhook,
} from "lucide-react";

import {
  ActionButton,
  Badge,
  EntityCell,
  MutedText,
  RowActions,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@factosys/ui";

import type { WebhookEndpoint } from "../types";

export type WebhookPendingAction = { id: string; action: "rotate" | "toggle" } | null;

export function WebhooksTable({
  endpoints,
  canManage,
  onRotate,
  onToggleStatus,
  onEdit,
  pending,
}: {
  endpoints: WebhookEndpoint[];
  canManage: boolean;
  onRotate: (ep: WebhookEndpoint) => void;
  onToggleStatus: (ep: WebhookEndpoint) => void;
  onEdit?: (ep: WebhookEndpoint) => void;
  pending?: WebhookPendingAction;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Endpoint</TH>
          <TH>Eventos</TH>
          <TH>Estado</TH>
          <TH>Secret</TH>
          <TH>Último éxito</TH>
          <TH className="text-end">Acciones</TH>
        </TR>
      </THead>
      <TBody>
        {endpoints.map((ep) => {
          const busy = pending?.id === ep.id;
          const isActive = ep.status === "active";
          return (
            <TR key={ep.id}>
              <TD label="Endpoint">
                <EntityCell
                  icon={Webhook}
                  tone={isActive ? "brand" : "muted"}
                  title={
                    <span
                      className="block max-w-xs truncate font-mono text-theme-xs max-md:max-w-48"
                      title={ep.url}
                    >
                      {ep.url}
                    </span>
                  }
                  subtitle={
                    ep.consecutive_failures > 0 ? (
                      <span className="flex items-center gap-1 text-error-600 dark:text-error-500">
                        <AlertTriangle className="size-3 shrink-0" aria-hidden />
                        {ep.consecutive_failures} fallos seguidos
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 aria-hidden />
                        Sin fallos recientes
                      </>
                    )
                  }
                />
              </TD>
              <TD label="Eventos">
                <div className="flex flex-wrap gap-1 max-md:justify-end">
                  {ep.events.map((e) => (
                    <Badge key={e} variant="outline" className="font-mono">
                      {e}
                    </Badge>
                  ))}
                </div>
              </TD>
              <TD label="Estado">
                <StatusBadge status={ep.status} label={statusLabel(ep.status)} />
              </TD>
              <TD label="Secret">
                <MutedText
                  as="span"
                  className="inline-flex items-center gap-1 font-mono text-theme-xs"
                >
                  <Lock className="size-3 shrink-0" aria-hidden />…{ep.secret_hint}
                </MutedText>
              </TD>
              <TD label="Último éxito">
                <MutedText as="span" className="whitespace-nowrap">
                  {ep.last_success_at ? formatDateTime(ep.last_success_at) : "Nunca"}
                </MutedText>
              </TD>
              <TD actions>
                <RowActions>
                  <ActionLink
                    size="icon-sm"
                    to={`/app/developers/webhooks/${ep.id}/deliveries`}
                    icon={History}
                    label="Ver entregas"
                  />
                  {canManage ? (
                    <>
                      {onEdit ? (
                        <ActionButton
                          size="icon-sm"
                          icon={Pencil}
                          label="Editar"
                          disabled={busy}
                          onClick={() => onEdit(ep)}
                        />
                      ) : null}
                      <ActionButton
                        size="icon-sm"
                        icon={RefreshCw}
                        label="Rotar secret"
                        pending={busy && pending?.action === "rotate"}
                        disabled={busy}
                        onClick={() => onRotate(ep)}
                      />
                      <ActionButton
                        size="icon-sm"
                        icon={isActive ? PowerOff : Power}
                        label={isActive ? "Desactivar" : "Activar"}
                        pending={busy && pending?.action === "toggle"}
                        disabled={busy}
                        onClick={() => onToggleStatus(ep)}
                      />
                    </>
                  ) : null}
                </RowActions>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
