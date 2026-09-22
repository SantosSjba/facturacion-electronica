import { Eye } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

import type { AuditEvent } from "../types";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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
          <TH>Actor</TH>
          <TH>Action</TH>
          <TH>Resource</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {events.map((e) => (
          <TR key={e.id}>
            <TD label="Fecha">
              <MutedText as="span">{formatDate(e.created_at)}</MutedText>
            </TD>
            <TD label="Actor">
              <div className="flex flex-col gap-0.5 max-md:items-end">
                <Badge variant="outline">{e.actor_type}</Badge>
                <MutedText as="span" className="font-mono text-theme-xs">
                  {e.actor_id ?? "—"}
                </MutedText>
              </div>
            </TD>
            <TD label="Action">
              <code className="text-theme-xs">{e.action}</code>
            </TD>
            <TD label="Resource">
              <MutedText as="span" className="font-mono text-theme-xs">
                {e.resource_type ?? "—"}
                {e.resource_id ? ` / ${e.resource_id}` : ""}
              </MutedText>
            </TD>
            <TD actions>
              <Button
                type="button"
                variant="outline"
                size="icon-label-sm"
                aria-label="Detalle"
                onClick={() => onSelect(e)}
              >
                <Eye className={buttonIconClassName} />
                <ButtonLabel>Detalle</ButtonLabel>
              </Button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
