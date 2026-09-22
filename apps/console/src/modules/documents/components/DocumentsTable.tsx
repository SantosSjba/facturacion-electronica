import { Link } from "react-router-dom";

import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

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
            <TD className="font-mono text-sm">{d.document_type}</TD>
            <TD>
              <Link
                to={`/documents/${d.id}`}
                className="font-medium text-[var(--primary)] hover:underline"
              >
                {d.serie_number ?? d.id.slice(0, 8)}
              </Link>
            </TD>
            <TD>{d.issue_date ?? "—"}</TD>
            <TD>{d.customer?.name ?? "—"}</TD>
            <TD>
              <StatusBadge status={d.status} />
            </TD>
            <TD className="font-mono text-sm text-[var(--muted-foreground)]">
              {d.sunat_code ?? "—"}
            </TD>
            <TD className="text-[var(--muted-foreground)]">
              {formatDate(d.created_at)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
