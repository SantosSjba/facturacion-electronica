import type { LucideIcon } from "lucide-react";
import { Cog, Eye, Headset, KeyRound, ScrollText, ShieldCheck, UserRound } from "lucide-react";

import {
  ActionButton,
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

import { formatDateTime } from "@/shared/ui/display-labels";

import type { AuditEvent } from "../api/audit";

const ACTOR_ICONS: Record<string, LucideIcon> = {
  user: UserRound,
  support: Headset,
  platform: ShieldCheck,
  api_key: KeyRound,
  system: Cog,
};

/** First UUID segment for dense tables; the full id stays in the tooltip and detail view. */
function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 13 ? `${id.slice(0, 8)}…` : id;
}

export function actorIcon(actorType: string): LucideIcon {
  return ACTOR_ICONS[actorType] ?? UserRound;
}

export function AuditTable({
  events,
  onSelect,
}: {
  events: AuditEvent[];
  onSelect: (event: AuditEvent) => void;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Fecha</TH>
          <TH>Acción</TH>
          <TH>Actor</TH>
          <TH>Organización</TH>
          <TH>Recurso</TH>
          <TH className="text-end">Acciones</TH>
        </TR>
      </THead>
      <TBody>
        {events.map((e) => (
          <TR key={e.id}>
            <TD label="Fecha">
              <MutedText as="span" className="whitespace-nowrap">
                {formatDateTime(e.created_at)}
              </MutedText>
            </TD>
            <TD label="Acción">
              <span className="inline-flex items-center gap-1.5 font-mono text-theme-xs text-gray-800 dark:text-white/90">
                <ScrollText className="size-3.5 shrink-0 text-gray-400" aria-hidden />
                {e.action}
              </span>
            </TD>
            <TD label="Actor">
              <EntityCell
                icon={actorIcon(e.actor_type)}
                tone="neutral"
                title={e.actor_type}
                subtitle={
                  <span className="font-mono" title={e.actor_id ?? undefined}>
                    {shortId(e.actor_id)}
                  </span>
                }
              />
            </TD>
            <TD label="Organización">
              <MutedText
                as="span"
                className="font-mono text-theme-xs"
                title={e.organization_id ?? undefined}
              >
                {shortId(e.organization_id)}
              </MutedText>
            </TD>
            <TD label="Recurso">
              <MutedText
                as="span"
                className="whitespace-nowrap font-mono text-theme-xs"
                title={e.resource_id ?? undefined}
              >
                {e.resource_type ?? "—"}
                {e.resource_id ? ` / ${shortId(e.resource_id)}` : ""}
              </MutedText>
            </TD>
            <TD actions>
              <RowActions>
                <ActionButton
                  size="icon-sm"
                  icon={Eye}
                  label="Detalle"
                  onClick={() => onSelect(e)}
                />
              </RowActions>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
