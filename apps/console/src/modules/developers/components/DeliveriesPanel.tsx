import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/shared/ui/components/badge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

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
      <div className="mt-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <LoadingState label="Cargando deliveries…" />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="mt-3">
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Error al cargar deliveries"
          }
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="mt-3">
        <EmptyState
          title="Sin deliveries"
          description="Aún no hay intentos de entrega para este endpoint."
        />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <MutedText as="p" className="text-theme-sm">
        Entregas recientes
      </MutedText>
      <Table>
        <THead>
          <TR>
            <TH>Evento</TH>
            <TH>Estado</TH>
            <TH>Intentos</TH>
            <TH>HTTP</TH>
            <TH>Creado</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((d) => (
            <TR key={d.id}>
              <TD label="Evento">
                <code className="text-theme-xs">{d.event_type}</code>
              </TD>
              <TD label="Estado">
                <Badge
                  variant={
                    d.status === "delivered"
                      ? "success"
                      : d.status === "failed"
                        ? "error"
                        : "muted"
                  }
                >
                  {d.status}
                </Badge>
              </TD>
              <TD label="Intentos">{d.attempt_count}</TD>
              <TD label="HTTP">{d.http_status ?? "—"}</TD>
              <TD label="Creado">
                <MutedText as="span">{formatDate(d.created_at)}</MutedText>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
