import { Box, Braces, Building2, Globe, Monitor, X } from "lucide-react";

import {
  ActionButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Badge,
  InfoField,
  InfoGrid,
  MutedText,
} from "@factosys/ui";

import { formatDateTime } from "@/shared/ui/display-labels";

import type { AuditEvent } from "../api/audit";
import { actorIcon } from "./AuditTable";

export function AuditDetailDrawer({
  event,
  onClose,
}: {
  event: AuditEvent | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(event)} onClose={onClose} ariaLabel="Detalle de auditoría" size="lg">
      {event ? (
        <>
          <DialogHeader
            title={event.action}
            description={`${event.actor_type} · ${formatDateTime(event.created_at)}`}
            onClose={onClose}
          />
          <DialogBody className="space-y-5">
            <InfoGrid>
              <InfoField icon={Building2} label="Organización" value={event.organization_id} mono />
              <InfoField
                icon={actorIcon(event.actor_type)}
                label="Actor"
                value={event.actor_id}
                mono
              />
              <InfoField
                icon={Box}
                label="Recurso"
                value={
                  event.resource_type
                    ? `${event.resource_type}${event.resource_id ? ` / ${event.resource_id}` : ""}`
                    : null
                }
                mono
              />
              <InfoField icon={Globe} label="IP" value={event.ip} mono />
              <InfoField
                icon={Monitor}
                label="User-Agent"
                value={event.user_agent}
                className="sm:col-span-2"
              />
            </InfoGrid>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Braces className="size-3.5 text-gray-400" aria-hidden />
                <MutedText as="span" className="text-xs uppercase tracking-wide">
                  Datos (redactados)
                </MutedText>
                <Badge variant="muted">json</Badge>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          </DialogBody>
          <DialogFooter>
            <ActionButton variant="primary" icon={X} label="Cerrar" onClick={onClose} />
          </DialogFooter>
        </>
      ) : null}
    </Dialog>
  );
}
