import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { cn } from "@/shared/ui/utils";

import { fetchOrgRoles } from "../api";

export function PermissionsMatrixPage() {
  const rolesQuery = useQuery({
    queryKey: ["org-roles"],
    queryFn: fetchOrgRoles,
  });

  const permissionRows = useMemo(() => {
    const roles = rolesQuery.data ?? [];
    const set = new Set<string>();
    for (const r of roles) {
      for (const p of r.permissions ?? []) set.add(p);
    }
    return [...set].sort();
  }, [rolesQuery.data]);

  if (rolesQuery.isLoading) {
    return <LoadingState label="Cargando matriz…" />;
  }

  if (rolesQuery.error) {
    return (
      <ErrorState
        message={
          rolesQuery.error instanceof Error
            ? rolesQuery.error.message
            : "Error al cargar roles"
        }
        onRetry={() => void rolesQuery.refetch()}
      />
    );
  }

  const roles = rolesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Matriz de permisos"
        description="Vista de solo lectura: rol → permisos (doc 33). Sin edición de matriz."
        actions={
          <Link
            to="/users"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-label-sm" }),
            )}
            aria-label="Usuarios"
          >
            <LinkIcon className={buttonIconClassName} />
            <ButtonLabel>Usuarios</ButtonLabel>
          </Link>
        }
      />

      <Table>
        <THead>
          <TR>
            <TH>Permiso</TH>
            {roles.map((r) => (
              <TH key={r.id} className="text-center">
                {r.code}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {permissionRows.map((perm) => (
            <TR key={perm}>
              <TD label="Permiso" className="font-mono text-xs">
                {perm}
              </TD>
              {roles.map((r) => {
                const has = (r.permissions ?? []).includes(perm);
                return (
                  <TD key={r.id} label={r.code} className="text-center">
                    {has ? (
                      <Check
                        className="mx-auto h-4 w-4 text-success-600 dark:text-success-500 max-md:ms-auto max-md:me-0"
                        aria-label="concedido"
                      />
                    ) : (
                      <MutedText as="span">·</MutedText>
                    )}
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
