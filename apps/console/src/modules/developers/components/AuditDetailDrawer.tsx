import { X } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { MutedText } from "@/shared/ui/components/muted-text";

import type { AuditEvent } from "../types";

export function AuditDetailDrawer({
  event,
  onClose,
}: {
  event: AuditEvent | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(event)}
      onClose={onClose}
      ariaLabel="Detalle de auditoría"
    >
      {event ? (
        <>
          <DialogHeader
            title={event.action}
            description={`${event.actor_type} · ${event.created_at}`}
            onClose={onClose}
          />
          <DialogBody className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <MutedText as="dt">Actor id</MutedText>
                <dd className="font-mono text-theme-sm break-all">
                  {event.actor_id ?? "—"}
                </dd>
              </div>
              <div>
                <MutedText as="dt">Resource</MutedText>
                <dd className="font-mono text-theme-sm break-all">
                  {event.resource_type ?? "—"}
                  {event.resource_id ? ` / ${event.resource_id}` : ""}
                </dd>
              </div>
              <div>
                <MutedText as="dt">IP</MutedText>
                <dd className="text-theme-sm">{event.ip ?? "—"}</dd>
              </div>
              <div>
                <MutedText as="dt">User-Agent</MutedText>
                <dd className="text-theme-xs break-all">
                  {event.user_agent ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MutedText as="span">Data (redactada)</MutedText>
                <Badge variant="muted">json</Badge>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <X className={buttonIconClassName} />
              <ButtonLabel>Cerrar</ButtonLabel>
            </Button>
          </DialogFooter>
        </>
      ) : null}
    </Dialog>
  );
}
