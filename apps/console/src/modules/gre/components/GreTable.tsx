import { Truck } from "lucide-react";

import { StatusBadge } from "@/modules/documents/components/StatusBadge";
import { DOC_TYPE_LABELS, formatDocDate } from "@/modules/documents/doc-labels";
import type { DocumentPublic } from "@/modules/documents/types";
import { Badge } from "@/shared/ui/components/badge";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { TextLink } from "@/shared/ui/components/text-link";
import { cn } from "@/shared/ui/utils";

export function GreTable({ documents }: { documents: DocumentPublic[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Documento</TH>
          <TH>Emisión</TH>
          <TH>Destinatario</TH>
          <TH>Estado</TH>
          <TH>SUNAT</TH>
          <TH>Creado</TH>
        </TR>
      </THead>
      <TBody>
        {documents.map((d) => {
          const typeLabel =
            DOC_TYPE_LABELS[d.document_type] ?? d.document_type;
          return (
            <TR key={d.id}>
              <TD label="Documento">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
                    )}
                    aria-hidden
                  >
                    <Truck className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <TextLink
                      to={`/gre/${d.id}`}
                      className="block truncate font-mono text-sm"
                    >
                      {d.serie_number ?? d.id.slice(0, 8)}
                    </TextLink>
                    <MutedText
                      as="span"
                      className="mt-0.5 flex items-center gap-1.5 text-theme-xs"
                    >
                      <Badge variant="outline" className="font-mono">
                        {d.document_type}
                      </Badge>
                      {typeLabel}
                    </MutedText>
                  </div>
                </div>
              </TD>
              <TD label="Emisión">
                <span className="font-mono text-theme-xs">
                  {d.issue_date ?? "—"}
                </span>
              </TD>
              <TD label="Destinatario">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                    {d.customer?.name ?? "—"}
                  </p>
                  {d.customer?.identity_number ? (
                    <MutedText as="span" className="font-mono text-theme-xs">
                      {d.customer.identity_type ?? ""}{" "}
                      {d.customer.identity_number}
                    </MutedText>
                  ) : null}
                </div>
              </TD>
              <TD label="Estado">
                <StatusBadge status={d.status} />
              </TD>
              <TD label="SUNAT">
                <MutedText as="span" className="font-mono text-theme-xs">
                  {d.sunat_code ?? "—"}
                </MutedText>
              </TD>
              <TD label="Creado">
                <MutedText as="span">{formatDocDate(d.created_at)}</MutedText>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
