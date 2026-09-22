import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { MutedText } from "@/shared/ui/components/muted-text";
import { TextLink } from "@/shared/ui/components/text-link";
import { StatusBadge } from "@/modules/documents/components/StatusBadge";
import type { DocumentPublic } from "@/modules/documents/types";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function GreTable({ documents }: { documents: DocumentPublic[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Tipo</TH>
          <TH>Serie-Número</TH>
          <TH>Emisión</TH>
          <TH>Destinatario</TH>
          <TH>Estado</TH>
          <TH>SUNAT</TH>
          <TH>Creado</TH>
        </TR>
      </THead>
      <TBody>
        {documents.map((d) => (
          <TR key={d.id}>
            <TD className="font-mono text-sm">{d.document_type}</TD>
            <TD>
              <TextLink to={`/gre/${d.id}`}>
                {d.serie_number ?? d.id.slice(0, 8)}
              </TextLink>
            </TD>
            <TD>{d.issue_date ?? "—"}</TD>
            <TD>{d.customer?.name ?? "—"}</TD>
            <TD>
              <StatusBadge status={d.status} />
            </TD>
            <TD className="font-mono text-sm">
              <MutedText as="span">{d.sunat_code ?? "—"}</MutedText>
            </TD>
            <TD>
              <MutedText as="span">{formatDate(d.created_at)}</MutedText>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
