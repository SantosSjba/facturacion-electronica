import { useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Code2,
  Eye,
  FileText,
  KeyRound,
  Shield,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/shared/ui/components/badge";
import {
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { cn } from "@/shared/ui/utils";

import { fetchOrgRoles } from "../api";
import type { OrgRole } from "../types";

const ROLE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  owner: Shield,
  admin: Wrench,
  operator: FileText,
  developer: Code2,
  viewer: Eye,
};

const RESOURCE_META: Record<
  string,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  users: { label: "Usuarios", icon: Users },
  companies: { label: "Empresas", icon: Shield },
  credentials: { label: "Credenciales", icon: KeyRound },
  series: { label: "Series", icon: FileText },
  documents: { label: "Documentos", icon: FileText },
  gre: { label: "GRE", icon: Truck },
  apikeys: { label: "API keys", icon: KeyRound },
  webhooks: { label: "Webhooks", icon: Code2 },
  validations: { label: "Validaciones", icon: Check },
  audit: { label: "Auditoría", icon: Eye },
  catalog: { label: "Catálogo", icon: FileText },
};

function resourceOf(permission: string): string {
  return permission.split(":")[0] ?? permission;
}

function RoleIcon({ code }: { code: string }) {
  const Icon = ROLE_ICONS[code] ?? Shield;
  return <Icon className="size-4" aria-hidden />;
}

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

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const perm of permissionRows) {
      const resource = resourceOf(perm);
      const list = map.get(resource) ?? [];
      list.push(perm);
      map.set(resource, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissionRows]);

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
    <div className="space-y-4">
      <PageHeader
        title="Matriz de permisos"
        description="Vista de solo lectura: rol → permisos. Sin edición de matriz."
        actions={
          <Link
            to="/users"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-label-sm" }),
            )}
            aria-label="Usuarios"
          >
            <ArrowLeft className={buttonIconClassName} />
            <ButtonLabel>Usuarios</ButtonLabel>
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {roles.map((role) => (
          <RoleSummaryCard key={role.id} role={role} />
        ))}
      </section>

      <Card className="overflow-hidden p-0 sm:p-0 max-md:border-0 max-md:bg-transparent">
        <div className="mb-4 border-b border-gray-200 px-5 py-4 max-md:mb-3 max-md:rounded-xl max-md:border max-md:border-gray-200 max-md:bg-white dark:border-gray-800 dark:max-md:border-gray-800 dark:max-md:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
              <Shield className="size-4" />
            </span>
            <div>
              <CardTitle className="mb-0">Matriz por permiso</CardTitle>
              <MutedText className="text-theme-xs">
                {permissionRows.length} permisos · {roles.length} roles
              </MutedText>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-md:overflow-visible">
          <Table>
            <THead>
              <TR>
                <TH>Permiso</TH>
                {roles.map((r) => (
                  <TH key={r.id} className="text-center">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <RoleIcon code={r.code} />
                      {r.code}
                    </span>
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {grouped.map(([resource, perms]) => {
                const meta = RESOURCE_META[resource];
                const Icon = meta?.icon ?? Shield;
                return (
                  <Fragment key={resource}>
                    <TR>
                      <TD
                        label="Grupo"
                        className="bg-gray-50 dark:bg-white/[0.02]"
                        colSpan={roles.length + 1}
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                          <Icon className="size-4 text-brand-500" aria-hidden />
                          {meta?.label ?? resource}
                        </span>
                      </TD>
                    </TR>
                    {perms.map((perm) => (
                      <TR key={perm}>
                        <TD label="Permiso">
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-theme-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">
                            {perm}
                          </code>
                        </TD>
                        {roles.map((r) => {
                          const has = (r.permissions ?? []).includes(perm);
                          return (
                            <TD
                              key={r.id}
                              label={r.code}
                              className="text-center"
                            >
                              {has ? (
                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500 max-md:ms-auto">
                                  <Check
                                    className="size-3.5"
                                    aria-label="concedido"
                                  />
                                </span>
                              ) : (
                                <MutedText
                                  as="span"
                                  className="text-gray-300 dark:text-gray-600"
                                >
                                  —
                                </MutedText>
                              )}
                            </TD>
                          );
                        })}
                      </TR>
                    ))}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function RoleSummaryCard({ role }: { role: OrgRole }) {
  const Icon = ROLE_ICONS[role.code] ?? Shield;
  const count = role.permissions?.length ?? 0;

  return (
    <Card className="p-4 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
              {role.name}
            </p>
            <Badge variant="outline">{role.code}</Badge>
          </div>
          <MutedText className="mt-1 line-clamp-2 text-theme-xs">
            {role.description ?? `${count} permisos`}
          </MutedText>
          <p className="mt-2 text-theme-xs font-medium text-gray-600 dark:text-gray-300">
            {count} permisos
          </p>
        </div>
      </div>
    </Card>
  );
}
