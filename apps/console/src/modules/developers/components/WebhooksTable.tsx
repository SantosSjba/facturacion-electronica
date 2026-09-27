import { History, Loader2, Pencil, Power, PowerOff, RefreshCw, Webhook } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { cn } from "@/shared/ui/utils";

import type { WebhookEndpoint } from "../types";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WebhooksTable({
  endpoints,
  canManage,
  onRotate,
  onToggleStatus,
  onEdit,
  pendingId,
}: {
  endpoints: WebhookEndpoint[];
  canManage: boolean;
  onRotate: (id: string) => void;
  onToggleStatus: (ep: WebhookEndpoint) => void;
  onEdit?: (ep: WebhookEndpoint) => void;
  pendingId?: string | null;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>URL</TH>
          <TH>Events</TH>
          <TH>Estado</TH>
          <TH>Secret</TH>
          <TH>Último éxito</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {endpoints.map((ep) => {
          const isPending = pendingId === ep.id;
          const isActive = ep.status === "active";
          return (
            <TR key={ep.id}>
              <TD label="URL">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                      isActive
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                        : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
                    )}
                    aria-hidden
                  >
                    <Webhook className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div
                      className="max-w-xs truncate font-mono text-theme-xs max-md:max-w-[12rem]"
                      title={ep.url}
                    >
                      {ep.url}
                    </div>
                    {ep.consecutive_failures > 0 ? (
                      <MutedText as="span" className="text-error-600">
                        {ep.consecutive_failures} fallos seguidos
                      </MutedText>
                    ) : null}
                  </div>
                </div>
              </TD>
              <TD label="Events">
                <div className="flex flex-wrap gap-1 max-md:justify-end">
                  {ep.events.map((e) => (
                    <Badge key={e} variant="outline">
                      {e}
                    </Badge>
                  ))}
                </div>
              </TD>
              <TD label="Estado">
                <Badge variant={isActive ? "success" : "muted"}>
                  {ep.status}
                </Badge>
              </TD>
              <TD label="Secret">
                <MutedText as="span">…{ep.secret_hint}</MutedText>
              </TD>
              <TD label="Último éxito">
                <MutedText as="span">{formatDate(ep.last_success_at)}</MutedText>
              </TD>
              <TD actions>
                <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                  <Link
                    to={`/developers/webhooks/${ep.id}/deliveries`}
                    className={cn(
                      buttonVariants({
                        variant: "outline",
                        size: "icon-label-sm",
                      }),
                    )}
                    aria-label="Ver entregas"
                  >
                    <History className={buttonIconClassName} />
                    <ButtonLabel>Deliveries</ButtonLabel>
                  </Link>
                  {canManage ? (
                    <>
                      {onEdit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-label-sm"
                          aria-label="Editar"
                          onClick={() => onEdit(ep)}
                        >
                          <Pencil className={buttonIconClassName} />
                          <ButtonLabel>Editar</ButtonLabel>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-label-sm"
                        aria-label="Rotar secret"
                        disabled={isPending}
                        onClick={() => onRotate(ep.id)}
                      >
                        {isPending ? (
                          <Loader2
                            className={cn(buttonIconClassName, "animate-spin")}
                          />
                        ) : (
                          <RefreshCw className={buttonIconClassName} />
                        )}
                        <ButtonLabel>Rotar secret</ButtonLabel>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-label-sm"
                        aria-label={isActive ? "Desactivar" : "Activar"}
                        disabled={isPending}
                        onClick={() => onToggleStatus(ep)}
                      >
                        {isPending ? (
                          <Loader2
                            className={cn(buttonIconClassName, "animate-spin")}
                          />
                        ) : isActive ? (
                          <PowerOff className={buttonIconClassName} />
                        ) : (
                          <Power className={buttonIconClassName} />
                        )}
                        <ButtonLabel>
                          {isActive ? "Desactivar" : "Activar"}
                        </ButtonLabel>
                      </Button>
                    </>
                  ) : null}
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
