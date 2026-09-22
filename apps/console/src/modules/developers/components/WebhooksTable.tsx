import {
  EyeOff,
  History,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
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
  expandedId,
  onToggleExpand,
  onRotate,
  onToggleStatus,
  pendingId,
}: {
  endpoints: WebhookEndpoint[];
  canManage: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onRotate: (id: string) => void;
  onToggleStatus: (ep: WebhookEndpoint) => void;
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
          const isExpanded = expandedId === ep.id;
          const isActive = ep.status === "active";
          return (
            <TR
              key={ep.id}
              className={
                isExpanded ? "bg-gray-50 dark:bg-white/[0.02]" : undefined
              }
            >
              <TD label="URL">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-label-sm"
                    aria-label={isExpanded ? "Ocultar" : "Deliveries"}
                    onClick={() => onToggleExpand(ep.id)}
                  >
                    {isExpanded ? (
                      <EyeOff className={buttonIconClassName} />
                    ) : (
                      <History className={buttonIconClassName} />
                    )}
                    <ButtonLabel>
                      {isExpanded ? "Ocultar" : "Deliveries"}
                    </ButtonLabel>
                  </Button>
                  {canManage ? (
                    <>
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
