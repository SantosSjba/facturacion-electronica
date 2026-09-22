import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

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
        {endpoints.map((ep) => (
          <TR key={ep.id} className={expandedId === ep.id ? "bg-gray-50 dark:bg-white/[0.02]" : undefined}>
            <TD>
              <div className="max-w-xs truncate font-mono text-theme-xs" title={ep.url}>
                {ep.url}
              </div>
              {ep.consecutive_failures > 0 ? (
                <MutedText as="span" className="text-error-600">
                  {ep.consecutive_failures} fallos seguidos
                </MutedText>
              ) : null}
            </TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                {ep.events.map((e) => (
                  <Badge key={e} variant="outline">
                    {e}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD>
              <Badge variant={ep.status === "active" ? "success" : "muted"}>
                {ep.status}
              </Badge>
            </TD>
            <TD>
              <MutedText as="span">…{ep.secret_hint}</MutedText>
            </TD>
            <TD>
              <MutedText as="span">{formatDate(ep.last_success_at)}</MutedText>
            </TD>
            <TD className="text-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleExpand(ep.id)}
                >
                  {expandedId === ep.id ? "Ocultar" : "Deliveries"}
                </Button>
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingId === ep.id}
                      onClick={() => onRotate(ep.id)}
                    >
                      Rotar secret
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingId === ep.id}
                      onClick={() => onToggleStatus(ep)}
                    >
                      {ep.status === "active" ? "Desactivar" : "Activar"}
                    </Button>
                  </>
                ) : null}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
