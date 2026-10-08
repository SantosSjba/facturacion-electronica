import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@factosys/ui";
import { Card, CardTitle } from "@factosys/ui";
import { EmptyState } from "@factosys/ui";
import { ErrorState } from "@factosys/ui";
import { LoadingState } from "@factosys/ui";
import { MutedText } from "@factosys/ui";
import { Table, TBody, TD, TH, THead, TR } from "@factosys/ui";

import { fetchWebhookDeliveries } from "../api";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function DeliveriesPanel({ endpointId }: { endpointId: string }) {
  const query = useQuery({
    queryKey: ["webhook-deliveries", endpointId],
    queryFn: () => fetchWebhookDeliveries(endpointId),
  });

  if (query.isLoading) {
    return (
      <Card>
        <LoadingState label="Cargando deliveries…" />
      </Card>
    );
  }

  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Error al cargar deliveries"}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin deliveries"
        description="Aún no hay intentos de entrega para este endpoint."
      />
    );
  }

  return (
    <Card className="overflow-hidden p-0 sm:p-0 max-md:border-0 max-md:bg-transparent">
      <div className="border-b border-gray-200 px-5 py-4 sm:px-6 dark:border-gray-800 max-md:border-0 max-md:px-0">
        <CardTitle className="mb-0">Entregas recientes</CardTitle>
        <MutedText className="mt-1 text-theme-xs">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </MutedText>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Evento</TH>
            <TH>Estado</TH>
            <TH>Intentos</TH>
            <TH>HTTP</TH>
            <TH>Error</TH>
            <TH>Creado</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((d) => {
            const ok = d.status === "delivered";
            const failed = d.status === "failed";
            return (
              <TR key={d.id}>
                <TD label="Evento">
                  <code className="text-theme-xs">{d.event_type}</code>
                </TD>
                <TD label="Estado">
                  <Badge variant={ok ? "success" : failed ? "error" : "muted"} className="gap-1">
                    {ok ? (
                      <CheckCircle2 className="size-3" aria-hidden />
                    ) : failed ? (
                      <XCircle className="size-3" aria-hidden />
                    ) : (
                      <AlertTriangle className="size-3" aria-hidden />
                    )}
                    {d.status}
                  </Badge>
                </TD>
                <TD label="Intentos">{d.attempt_count}</TD>
                <TD label="HTTP">
                  <span className="font-mono text-theme-xs">{d.http_status ?? "—"}</span>
                </TD>
                <TD label="Error">
                  <MutedText
                    as="span"
                    className="line-clamp-2 max-w-xs text-theme-xs"
                    title={d.last_error ?? undefined}
                  >
                    {d.last_error ?? "—"}
                  </MutedText>
                </TD>
                <TD label="Creado">
                  <MutedText as="span">{formatDate(d.created_at)}</MutedText>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
