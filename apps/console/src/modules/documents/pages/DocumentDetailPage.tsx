import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/components/badge";

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
            className="text-sm text-[var(--primary)] hover:underline"
          >
            ← Volver a lista
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
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="mb-2 text-sm font-semibold">Cliente</h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-[var(--muted-foreground)]">Tipo</dt>
              <dd>{doc.customer.identity_type ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Número</dt>
              <dd className="font-mono">{doc.customer.identity_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Nombre</dt>
              <dd>{doc.customer.name ?? "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="mb-2 text-sm font-semibold">Totales</h2>
          <p className="mb-2 text-sm">
            Moneda: <span className="font-mono">{doc.currency ?? "—"}</span>
          </p>
          <pre className="max-h-40 overflow-auto rounded-md bg-[var(--muted)] p-2 text-xs">
            {JSON.stringify(doc.totals ?? {}, null, 2)}
          </pre>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] p-4">
        <h2 className="mb-2 text-sm font-semibold">SUNAT</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--muted-foreground)]">Ticket</dt>
            <dd className="font-mono">{doc.sunat_ticket ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">Código</dt>
            <dd className="font-mono">{doc.sunat_code ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">Mensaje</dt>
            <dd>{doc.sunat_message ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {doc.error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-800">Error</h2>
          <pre className="overflow-auto text-xs text-red-900">
            {JSON.stringify(doc.error, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-lg border border-[var(--border)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Artefactos</h2>
        <ArtifactButtons documentId={doc.id} />
      </section>

      <section className="rounded-lg border border-[var(--border)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
        {traceQuery.isLoading ? (
          <LoadingState label="Cargando eventos…" />
        ) : (
          <DocumentTimeline events={traceQuery.data ?? []} />
        )}
      </section>
    </div>
  );
}
