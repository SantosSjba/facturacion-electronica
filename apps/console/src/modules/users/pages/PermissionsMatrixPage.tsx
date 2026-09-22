import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

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
            className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Usuarios
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
              <TD className="font-mono text-xs">{perm}</TD>
              {roles.map((r) => {
                const has = (r.permissions ?? []).includes(perm);
                return (
                  <TD key={r.id} className="text-center">
                    {has ? (
                      <Check
                        className="mx-auto h-4 w-4 text-teal-700"
                        aria-label="concedido"
                      />
                    ) : (
                      <span className="text-[var(--muted-foreground)]">·</span>
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
