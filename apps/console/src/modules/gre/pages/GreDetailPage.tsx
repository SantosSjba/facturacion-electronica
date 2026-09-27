import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  Hash,
  IdCard,
  MessageSquareText,
  Ticket,
  Truck,
  UserRound,
} from "lucide-react";

import { ArtifactButtons } from "@/modules/documents/components/ArtifactButtons";
import { DocumentTimeline } from "@/modules/documents/components/DocumentTimeline";
import { StatusBadge } from "@/modules/documents/components/StatusBadge";
import {
  DOC_TYPE_LABELS,
  IDENTITY_TYPE_LABELS,
  formatDocDate,
} from "@/modules/documents/doc-labels";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
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

function MetaRow({
  icon: Icon,
  label,
  children,
  mono,
}: {
  icon: typeof Truck;
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <MutedText as="dt" className="text-theme-xs">
          {label}
        </MutedText>
        <dd
          className={cn(
            "mt-0.5 text-sm text-gray-800 dark:text-white/90",
            mono && "font-mono break-all",
          )}
        >
          {children}
        </dd>
      </div>
    </div>
  );
}

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
  const typeLabel = DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type;
  const identityLabel =
    IDENTITY_TYPE_LABELS[doc.customer.identity_type ?? ""] ??
    doc.customer.identity_type ??
    "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl",
              "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
            )}
            aria-hidden
          >
            <Truck className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
                {doc.serie_number ?? doc.id.slice(0, 8)}
              </h1>
              <Badge variant="outline" className="font-mono">
                {doc.document_type}
              </Badge>
            </div>
            <MutedText className="mt-1">{typeLabel}</MutedText>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} />
              <Badge variant="outline" className="gap-1 capitalize">
                <Building2 className="size-3" aria-hidden />
                {doc.environment}
              </Badge>
            </div>
          </div>
        </div>
        <Link
          to="/gre"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-label-sm" }),
          )}
          aria-label="Volver a GRE"
        >
          <ArrowLeft className={buttonIconClassName} />
          <ButtonLabel>GRE</ButtonLabel>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle className="flex items-center gap-2">
            <Hash className="size-3.5 text-gray-400" aria-hidden />
            Datos de la guía
          </CardTitle>
          <dl className="grid gap-4 sm:grid-cols-2">
            <MetaRow icon={CalendarDays} label="Fecha de emisión">
              {formatDocDate(doc.issue_date)}
            </MetaRow>
            <MetaRow icon={Clock3} label="Creado">
              {formatDocDate(doc.created_at)}
            </MetaRow>
            <MetaRow icon={Hash} label="ID" mono>
              {doc.id}
            </MetaRow>
          </dl>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-3.5 text-gray-400" aria-hidden />
            Destinatario
          </CardTitle>
          <dl className="space-y-4">
            <MetaRow icon={IdCard} label="Documento">
              <span className="block">{identityLabel}</span>
              <span className="font-mono text-theme-sm">
                {doc.customer.identity_number ?? "—"}
              </span>
            </MetaRow>
            <MetaRow icon={UserRound} label="Nombre">
              {doc.customer.name ?? "—"}
            </MetaRow>
          </dl>
        </Card>

        <Card className="lg:col-span-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-3.5 text-gray-400" aria-hidden />
            SUNAT
          </CardTitle>
          <dl className="grid gap-4 sm:grid-cols-3">
            <MetaRow icon={Ticket} label="Ticket" mono>
              {doc.sunat_ticket ?? "—"}
            </MetaRow>
            <MetaRow icon={Hash} label="Código" mono>
              {doc.sunat_code ?? "—"}
            </MetaRow>
            <MetaRow icon={MessageSquareText} label="Mensaje">
              {doc.sunat_message ?? "—"}
            </MetaRow>
          </dl>
        </Card>
      </div>

      {doc.error ? (
        <section className="rounded-2xl border border-error-200 bg-error-50 p-4 sm:p-5 dark:border-error-500/30 dark:bg-error-500/10">
          <h2 className="mb-2 text-sm font-semibold text-error-700 dark:text-error-400">
            Error
          </h2>
          <pre className="overflow-auto rounded-xl bg-white/60 p-3 text-xs text-error-800 dark:bg-black/20 dark:text-error-400">
            {JSON.stringify(doc.error, null, 2)}
          </pre>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-3.5 text-gray-400" aria-hidden />
            Artefactos
          </CardTitle>
          <ArtifactButtons documentId={doc.id} />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="size-3.5 text-gray-400" aria-hidden />
            Timeline
          </CardTitle>
          {traceQuery.isLoading ? (
            <LoadingState label="Cargando eventos…" />
          ) : (
            <DocumentTimeline events={traceQuery.data ?? []} />
          )}
        </Card>
      </div>
    </div>
  );
}
