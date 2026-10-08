import { formatDateTime, statusLabel } from "@/shared/ui/display-labels";
import { BackLink } from "@/shared/ui/components/action-link";
import { StatusBadge } from "@/shared/ui/status-badge";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  History,
  Link2,
  Lock,
  Webhook,
  Zap,
} from "lucide-react";

import {
  Badge,
  ErrorState,
  InfoField,
  InfoGrid,
  LoadingState,
  PageHeader,
  SectionCard,
} from "@factosys/ui";

import { fetchWebhooks } from "../api";
import { DeliveriesPanel } from "../components/DeliveriesPanel";

export function WebhookDeliveriesPage() {
  const { id = "" } = useParams();

  const webhooksQuery = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  const endpoint = (webhooksQuery.data ?? []).find((ep) => ep.id === id);

  if (webhooksQuery.isLoading) {
    return <LoadingState variant="detail" label="Cargando webhook…" />;
  }

  if (webhooksQuery.error) {
    return (
      <ErrorState
        message={
          webhooksQuery.error instanceof Error
            ? webhooksQuery.error.message
            : "Error al cargar webhook"
        }
        onRetry={() => void webhooksQuery.refetch()}
      />
    );
  }

  if (!endpoint) {
    return (
      <ErrorState message="Webhook no encontrado" onRetry={() => void webhooksQuery.refetch()} />
    );
  }

  const active = endpoint.status === "active";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="Entregas del webhook"
        description="Intentos recientes de entrega hacia tu endpoint."
        actions={<BackLink to="/app/developers/webhooks" />}
      />

      <SectionCard
        icon={Webhook}
        tone={active ? "brand" : "muted"}
        title="Endpoint"
        description={<StatusBadge status={endpoint.status} label={statusLabel(endpoint.status)} />}
      >
        <InfoGrid className="lg:grid-cols-3">
          <InfoField
            icon={Link2}
            label="URL"
            value={endpoint.url}
            mono
            className="sm:col-span-2 lg:col-span-3"
          />
          <InfoField
            icon={Zap}
            label="Eventos"
            value={
              <span className="flex flex-wrap gap-1">
                {endpoint.events.map((ev) => (
                  <Badge key={ev} variant="outline" className="font-mono">
                    {ev}
                  </Badge>
                ))}
              </span>
            }
          />
          <InfoField icon={Lock} label="Secret" value={`…${endpoint.secret_hint}`} mono />
          <InfoField
            icon={endpoint.consecutive_failures > 0 ? AlertTriangle : CheckCircle2}
            label="Fallos seguidos"
            value={String(endpoint.consecutive_failures)}
          />
          <InfoField
            icon={CheckCircle2}
            label="Último éxito"
            value={endpoint.last_success_at ? formatDateTime(endpoint.last_success_at) : "Nunca"}
          />
          <InfoField
            icon={CalendarPlus}
            label="Creado"
            value={formatDateTime(endpoint.created_at)}
          />
        </InfoGrid>
      </SectionCard>

      <DeliveriesPanel endpointId={endpoint.id} />
    </div>
  );
}
