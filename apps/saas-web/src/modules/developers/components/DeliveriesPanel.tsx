import { formatDateTime, statusLabel } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";
import { useQuery } from "@tanstack/react-query";
import { History, Inbox, RotateCw, Zap } from "lucide-react";

import {
  Badge,
  EmptyState,
  ErrorState,
  IconTile,
  LoadingState,
  MutedText,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@factosys/ui";

import { fetchWebhookDeliveries } from "../api";

function httpColor(status: number | null) {
  if (status === null) return "muted" as const;
  if (status >= 200 && status < 300) return "success" as const;
  if (status >= 400) return "error" as const;
  return "warning" as const;
}

export function DeliveriesPanel({ endpointId }: { endpointId: string }) {
  const query = useQuery({
    queryKey: ["webhook-deliveries", endpointId],
    queryFn: () => fetchWebhookDeliveries(endpointId),
  });

  if (query.isLoading) {
    return <LoadingState variant="table" label="Cargando deliveries…" />;
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
        icon={Inbox}
        title="Sin deliveries"
        description="Aún no hay intentos de entrega para este endpoint."
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <IconTile icon={History} size="sm" />
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Entregas recientes
          </h2>
          <MutedText className="text-theme-xs">
            {rows.length} registro{rows.length === 1 ? "" : "s"}
          </MutedText>
        </div>
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
          {rows.map((d) => (
            <TR key={d.id}>
              <TD label="Evento">
                <span className="inline-flex items-center gap-1.5 font-mono text-theme-xs text-gray-800 dark:text-white/90">
                  <Zap className="size-3.5 shrink-0 text-gray-400" aria-hidden />
                  {d.event_type}
                </span>
              </TD>
              <TD label="Estado">
                <StatusBadge status={d.status} label={statusLabel(d.status)} />
              </TD>
              <TD label="Intentos">
                <span className="inline-flex items-center gap-1.5">
                  <RotateCw className="size-3.5 shrink-0 text-gray-400" aria-hidden />
                  {d.attempt_count}
                </span>
              </TD>
              <TD label="HTTP">
                {d.http_status !== null ? (
                  <Badge color={httpColor(d.http_status)} className="font-mono">
                    {d.http_status}
                  </Badge>
                ) : (
                  <MutedText as="span">—</MutedText>
                )}
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
                <MutedText as="span" className="whitespace-nowrap">
                  {formatDateTime(d.created_at)}
                </MutedText>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </section>
  );
}
