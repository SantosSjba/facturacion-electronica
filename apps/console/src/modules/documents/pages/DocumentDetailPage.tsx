import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

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
import { ArtifactButtons } from "../components/ArtifactButtons";
import { DocumentTimeline } from "../components/DocumentTimeline";
import { StatusBadge } from "../components/StatusBadge";

export function DocumentDetailPage() {
  const { id = "" } = useParams();

  const docQuery = useQuery({
    queryKey: ["document", id],
    queryFn: () => fetchDocument(id),
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (
        status &&
        ["accepted", "accepted_with_observation", "rejected", "failed", "cancelled"].includes(
          status,
        )
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
    return <LoadingState label="Cargando documento…" />;
  }

  if (docQuery.error || !docQuery.data) {
    return (
      <ErrorState
        message={
          docQuery.error instanceof Error
            ? docQuery.error.message
            : "Documento no encontrado"
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
            to="/documents"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-label-sm" }),
            )}
            aria-label="Volver a lista"
          >
            <ArrowLeft className={buttonIconClassName} />
            <ButtonLabel>Volver a lista</ButtonLabel>
          </Link>
        }
      />

      <section className="flex flex-wrap items-center gap-2">
        <StatusBadge status={doc.status} />
        <Badge variant="outline">{doc.environment}</Badge>
        {doc.summary_status ? (
          <Badge variant="muted">summary: {doc.summary_status}</Badge>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-lg p-4 sm:p-4">
          <CardTitle className="mb-2">Cliente</CardTitle>
          <dl className="space-y-1 text-sm">
            <div>
              <MutedText as="dt">Tipo</MutedText>
              <dd>{doc.customer.identity_type ?? "—"}</dd>
            </div>
            <div>
              <MutedText as="dt">Número</MutedText>
              <dd className="font-mono">{doc.customer.identity_number ?? "—"}</dd>
            </div>
            <div>
              <MutedText as="dt">Nombre</MutedText>
              <dd>{doc.customer.name ?? "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card className="rounded-lg p-4 sm:p-4">
          <CardTitle className="mb-2">Totales</CardTitle>
          <p className="mb-2 text-sm">
            Moneda: <span className="font-mono">{doc.currency ?? "—"}</span>
          </p>
          <pre className="max-h-40 overflow-auto rounded-md bg-gray-100 p-2 text-xs dark:bg-white/5">
            {JSON.stringify(doc.totals ?? {}, null, 2)}
          </pre>
        </Card>
      </section>

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
          <h2 className="mb-2 text-sm font-semibold text-error-700 dark:text-error-400">Error</h2>
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
