import { ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { consolePublicUrl } from "@/app/nav-config";
import { fetchCompanies } from "@/modules/app/api/companies";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function AppCompaniesPage() {
  const query = useQuery({
    queryKey: ["org-companies"],
    queryFn: fetchCompanies,
  });

  const companies = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Vista de solo lectura. Crea y configura empresas en la consola de emisión."
        actions={
          <a
            href={consolePublicUrl("/companies")}
            target="_blank"
            rel="noreferrer"
          >
            <Button type="button" size="sm">
              <ExternalLink className={buttonIconClassName} />
              <ButtonLabel>Abrir en consola</ButtonLabel>
            </Button>
          </a>
        }
      />

      {query.isLoading ? <LoadingState label="Cargando empresas…" /> : null}
      {query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "No se pudieron cargar las empresas"
          }
        />
      ) : null}

      {!query.isLoading && !query.error && companies.length === 0 ? (
        <EmptyState
          title="Aún no hay empresas"
          description="Crea tu primera empresa en la consola para emitir comprobantes."
          action={
            <a
              href={consolePublicUrl("/companies")}
              target="_blank"
              rel="noreferrer"
            >
              <Button type="button" size="sm">
                <ExternalLink className={buttonIconClassName} />
                <ButtonLabel>Ir a consola</ButtonLabel>
              </Button>
            </a>
          }
        />
      ) : null}

      {!query.isLoading && !query.error && companies.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>RUC</TH>
              <TH>Razón social</TH>
              <TH>Ambiente</TH>
              <TH>Estado</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {companies.map((c) => (
              <TR key={c.id}>
                <TD label="RUC" className="font-mono">
                  {c.ruc}
                </TD>
                <TD label="Razón social">{c.legal_name}</TD>
                <TD label="Ambiente">
                  <Badge variant="outline">{c.environment}</Badge>
                </TD>
                <TD label="Estado">
                  <Badge
                    variant={c.status === "active" ? "success" : "muted"}
                  >
                    {c.status}
                  </Badge>
                </TD>
                <TD actions>
                  <a
                    href={consolePublicUrl(`/companies/${c.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Abrir
                  </a>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : null}
    </div>
  );
}
