import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  Hash,
  IdCard,
  MessageSquareText,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";

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
import { ArtifactButtons } from "../components/ArtifactButtons";
import { DocumentTimeline } from "../components/DocumentTimeline";
import { StatusBadge } from "../components/StatusBadge";
import {
  DOC_TYPE_LABELS,
  IDENTITY_TYPE_LABELS,
  TOTAL_LABELS,
  formatDocDate,
  formatMoney,
} from "../doc-labels";

function MetaRow({
  icon: Icon,
  label,
  children,
  mono,
}: {
  icon: typeof FileText;
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

function TotalsList({
  totals,
  currency,
}: {
  totals: Record<string, unknown> | null;
  currency: string | null;
}) {
  if (!totals || Object.keys(totals).length === 0) {
    return <MutedText>Sin totales registrados.</MutedText>;
  }

  const entries = Object.entries(totals);
  const preferred = [
    "total_taxed",
    "total_exonerated",
    "total_unaffected",
    "total_igv",
    "total_payable",
    "payable_amount",
    "tax_inclusive_amount",
  ];
  const ordered = [
    ...preferred.filter((k) => k in totals),
    ...entries.map(([k]) => k).filter((k) => !preferred.includes(k)),
  ];

  const payableKey = ordered.find(
    (k) =>
      k === "total_payable" ||
      k === "payable_amount" ||
      k === "tax_inclusive_amount",
  );

  return (
    <div className="space-y-3">
      {payableKey ? (
        <div className="rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
          <MutedText className="text-theme-xs">
            {TOTAL_LABELS[payableKey] ?? payableKey}
          </MutedText>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-brand-700 dark:text-brand-300">
            {formatMoney(totals[payableKey], currency)}
          </p>
        </div>
      ) : null}
      <dl className="space-y-2">
        {ordered
          .filter((k) => k !== payableKey)
          .map((key) => {
            const value = totals[key];
            const isNumeric =
              typeof value === "number" ||
              (typeof value === "string" && value !== "" && !Number.isNaN(Number(value)));
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800"
              >
                <MutedText as="dt" className="text-theme-xs">
                  {TOTAL_LABELS[key] ?? key}
                </MutedText>
                <dd className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {isNumeric
                    ? formatMoney(value, currency)
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value ?? "—")}
                </dd>
              </div>
            );
          })}
      </dl>
    </div>
  );
}

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
            <FileText className="size-5" />
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
              {doc.summary_status ? (
                <Badge variant="muted">Resumen: {doc.summary_status}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <Link
          to="/documents"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-label-sm" }),
          )}
          aria-label="Volver a comprobantes"
        >
          <ArrowLeft className={buttonIconClassName} />
          <ButtonLabel>Comprobantes</ButtonLabel>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle className="flex items-center gap-2">
            <Hash className="size-3.5 text-gray-400" aria-hidden />
            Datos del comprobante
          </CardTitle>
          <dl className="grid gap-4 sm:grid-cols-2">
            <MetaRow icon={CalendarDays} label="Fecha de emisión">
              {formatDocDate(doc.issue_date)}
            </MetaRow>
            <MetaRow icon={Clock3} label="Creado">
              {formatDocDate(doc.created_at)}
            </MetaRow>
            <MetaRow icon={Wallet} label="Moneda">
              {doc.currency ?? "—"}
            </MetaRow>
            <MetaRow icon={Hash} label="ID" mono>
              {doc.id}
            </MetaRow>
          </dl>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-3.5 text-gray-400" aria-hidden />
            Totales
          </CardTitle>
          <TotalsList totals={doc.totals} currency={doc.currency} />
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-3.5 text-gray-400" aria-hidden />
            Cliente
          </CardTitle>
          <dl className="space-y-4">
            <MetaRow icon={IdCard} label="Documento">
              <span className="block">{identityLabel}</span>
              <span className="font-mono text-theme-sm">
                {doc.customer.identity_number ?? "—"}
              </span>
            </MetaRow>
            <MetaRow icon={UserRound} label="Nombre / Razón social">
              {doc.customer.name ?? "—"}
            </MetaRow>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
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
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-error-700 dark:text-error-400">
            <MessageSquareText className="size-4" aria-hidden />
            Error
            {doc.error.code ? (
              <Badge variant="outline" className="font-mono">
                {doc.error.code}
              </Badge>
            ) : null}
          </h2>
          {doc.error.message ? (
            <p className="mb-2 text-sm text-error-800 dark:text-error-400">
              {doc.error.message}
            </p>
          ) : null}
          <pre className="overflow-auto rounded-xl bg-white/60 p-3 text-xs text-error-800 dark:bg-black/20 dark:text-error-400">
            {JSON.stringify(doc.error, null, 2)}
          </pre>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-3.5 text-gray-400" aria-hidden />
            Artefactos
          </CardTitle>
          <MutedText className="mb-3 text-theme-xs">
            Descarga XML, CDR o PDF del comprobante.
          </MutedText>
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
