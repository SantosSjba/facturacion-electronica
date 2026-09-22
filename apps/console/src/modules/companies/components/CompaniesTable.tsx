import type { Company } from "../types";
import { Badge } from "@/shared/ui/components/badge";
import { MutedText } from "@/shared/ui/components/muted-text";
import { TextLink } from "@/shared/ui/components/text-link";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function CompaniesTable({ companies }: { companies: Company[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>RUC</TH>
          <TH>Razón social</TH>
          <TH>Ambiente</TH>
          <TH>Certificado</TH>
          <TH>Actualizado</TH>
        </TR>
      </THead>
      <TBody>
        {companies.map((c) => (
          <TR key={c.id}>
            <TD>
              <TextLink to={`/companies/${c.id}/overview`}>
                {c.ruc}
              </TextLink>
            </TD>
            <TD>{c.legal_name}</TD>
            <TD>
              <Badge variant="outline">{c.environment}</Badge>
            </TD>
            <TD>
              <Badge
                variant={
                  c.certificate_status === "active" ? "success" : "muted"
                }
              >
                {c.certificate_status}
              </Badge>
            </TD>
            <TD>
              <MutedText as="span">{formatDate(c.updated_at)}</MutedText>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
