import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { MutedText } from "@/shared/ui/components/muted-text";
import { TextLink } from "@/shared/ui/components/text-link";

import type { DocumentPublic } from "../types";
import { StatusBadge } from "./StatusBadge";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function DocumentsTable({ documents }: { documents: DocumentPublic[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Tipo</TH>
          <TH>Serie-Número</TH>
          <TH>Emisión</TH>
          <TH>Cliente</TH>
          <TH>Estado</TH>
          <TH>SUNAT</TH>
          <TH>Creado</TH>
        </TR>
      </THead>
      <TBody>
        {documents.map((d) => (
          <TR key={d.id}>
            <TD label="Tipo" className="font-mono text-sm">
              {d.document_type}
            </TD>
            <TD label="Serie-Número">
              <TextLink to={`/documents/${d.id}`}>
                {d.serie_number ?? d.id.slice(0, 8)}
              </TextLink>
            </TD>
            <TD label="Emisión">{d.issue_date ?? "—"}</TD>
            <TD label="Cliente">{d.customer?.name ?? "—"}</TD>
            <TD label="Estado">
              <StatusBadge status={d.status} />
            </TD>
            <TD label="SUNAT" className="font-mono text-sm">
              <MutedText as="span">{d.sunat_code ?? "—"}</MutedText>
            </TD>
            <TD label="Creado">
              <MutedText as="span">{formatDate(d.created_at)}</MutedText>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
