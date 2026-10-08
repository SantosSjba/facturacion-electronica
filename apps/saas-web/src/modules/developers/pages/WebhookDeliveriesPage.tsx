import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Webhook } from "lucide-react";

import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/components/badge";
import { ButtonLabel, buttonIconClassName, buttonVariants } from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

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
    return <LoadingState label="Cargando webhook…" />;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entregas del webhook"
        description="Intentos recientes de entrega hacia tu endpoint."
        actions={
          <Link
            to="/app/developers/webhooks"
            className={cn(buttonVariants({ variant: "outline", size: "icon-label-sm" }))}
            aria-label="Volver a webhooks"
          >
            <ArrowLeft className={buttonIconClassName} />
            <ButtonLabel>Webhooks</ButtonLabel>
          </Link>
        }
      />

      <Card>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="size-3.5 text-gray-400" aria-hidden />
          Endpoint
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={endpoint.status === "active" ? "success" : "muted"}>
            {endpoint.status}
          </Badge>
          {endpoint.events.map((ev) => (
            <Badge key={ev} variant="outline">
              {ev}
            </Badge>
          ))}
        </div>
        <MutedText className="mt-3 break-all font-mono text-theme-xs">{endpoint.url}</MutedText>
      </Card>

      <DeliveriesPanel endpointId={endpoint.id} />
    </div>
  );
}
