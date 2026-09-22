import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { ArtifactButtons } from "@/modules/documents/components/ArtifactButtons";
import { DocumentTimeline } from "@/modules/documents/components/DocumentTimeline";
import { StatusBadge } from "@/modules/documents/components/StatusBadge";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/components/badge";
import {
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

import { fetchDocument, fetchDocumentTrace } from "../api";

export function GreDetailPage() {
  const { id = "" } = useParams();

  const docQuery = useQuery({
    queryKey: ["document", id],
    queryFn: () => fetchDocument(id),
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (
        status &&
        [
          "accepted",
          "accepted_with_observation",
          "rejected",
          "failed",
          "cancelled",
        ].includes(status)
      ) {
        return false;
      }
      return 2000;
    },
  });

  const traceQuery = useQuery({
    queryKey: ["document-trace", id],
    queryFn: () => fetchDocumentTrace(id),
    enabled: Boolean(id),
  });

  if (docQuery.isLoading) {
    return <LoadingState label="Cargando guía…" />;
  }

  if (docQuery.error || !docQuery.data) {
    return (
      <ErrorState
        message={
          docQuery.error instanceof Error
            ? docQuery.error.message
            : "Guía no encontrada"
        }
        onRetry={() => void docQuery.refetch()}
      />
    );
  }

  const doc = docQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${doc.document_type} ${doc.serie_number ?? ""}`.trim()}
        description={`ID ${doc.id}`}
        actions={
          <Link
            to="/gre"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-label-sm" }),
            )}
            aria-label="Volver a GRE"
          >
            <ArrowLeft className={buttonIconClassName} />
            <ButtonLabel>Volver a GRE</ButtonLabel>
          </Link>
        }
      />

      <section className="flex flex-wrap items-center gap-2">
        <StatusBadge status={doc.status} />
        <Badge variant="outline">{doc.environment}</Badge>
      </section>

      <Card className="rounded-lg p-4 sm:p-4">
        <CardTitle className="mb-2">Destinatario</CardTitle>
        <dl className="space-y-1 text-sm">
          <div>
            <MutedText as="dt">Tipo</MutedText>
            <dd>{doc.customer.identity_type ?? "—"}</dd>
          </div>
          <div>
            <MutedText as="dt">Número</MutedText>
            <dd className="font-mono">
              {doc.customer.identity_number ?? "—"}
            </dd>
          </div>
          <div>
            <MutedText as="dt">Nombre</MutedText>
            <dd>{doc.customer.name ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="rounded-lg p-4 sm:p-4">
        <CardTitle className="mb-2">SUNAT</CardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <MutedText as="dt">Ticket</MutedText>
            <dd className="font-mono">{doc.sunat_ticket ?? "—"}</dd>
          </div>
          <div>
            <MutedText as="dt">Código</MutedText>
            <dd className="font-mono">{doc.sunat_code ?? "—"}</dd>
          </div>
          <div>
            <MutedText as="dt">Mensaje</MutedText>
            <dd>{doc.sunat_message ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      {doc.error ? (
        <section className="rounded-lg border border-error-200 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/10">
          <h2 className="mb-2 text-sm font-semibold text-error-700 dark:text-error-400">
            Error
          </h2>
          <pre className="overflow-auto text-xs text-error-800 dark:text-error-400">
            {JSON.stringify(doc.error, null, 2)}
          </pre>
        </section>
      ) : null}

      <Card className="rounded-lg p-4 sm:p-4">
        <CardTitle className="mb-3">Artefactos</CardTitle>
        <ArtifactButtons documentId={doc.id} />
      </Card>

      <Card className="rounded-lg p-4 sm:p-4">
        <CardTitle className="mb-3">Timeline</CardTitle>
        {traceQuery.isLoading ? (
          <LoadingState label="Cargando eventos…" />
        ) : (
          <DocumentTimeline events={traceQuery.data ?? []} />
        )}
      </Card>
    </div>
  );
}
