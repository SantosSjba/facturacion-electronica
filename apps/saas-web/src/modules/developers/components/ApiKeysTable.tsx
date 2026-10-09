import { environmentLabel, formatDateTime, statusLabel } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";
import { Ban, Building2, Globe, KeyRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApiKeyCompanies } from "../api";

import {
  ActionButton,
  Badge,
  EntityCell,
  MutedText,
  RowActions,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@factosys/ui";

import type { ApiKey } from "../types";

export function ApiKeysTable({
  keys,
  canManage,
  onRevoke,
  onAssign,
  revokingId,
}: {
  keys: ApiKey[];
  canManage: boolean;
  onRevoke: (key: ApiKey) => void;
  onAssign: (key: ApiKey) => void;
  revokingId?: string | null;
}) {
  const companies = useQuery({
    queryKey: ["api-key-companies"],
    queryFn: fetchApiKeyCompanies,
    enabled: canManage,
  });
  return (
    <Table>
      <THead>
        <TR>
          <TH>Nombre</TH>
          <TH>Prefijo</TH>
          <TH>Permisos</TH>
          <TH>Empresas</TH>
          <TH>Estado</TH>
          <TH>Último uso</TH>
          <TH className="text-end">Acciones</TH>
        </TR>
      </THead>
      <TBody>
        {keys.map((k) => (
          <TR key={k.id}>
            <TD label="Nombre">
              <EntityCell
                icon={KeyRound}
                tone={k.status === "active" ? "brand" : "muted"}
                title={k.name}
                subtitle={
                  <>
                    <Globe aria-hidden />
                    {k.environmentConstraint
                      ? environmentLabel(k.environmentConstraint)
                      : "Todos los ambientes"}
                  </>
                }
              />
            </TD>
            <TD label="Prefijo">
              <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">
                {k.keyPrefix}…
              </code>
            </TD>
            <TD label="Permisos">
              <div className="flex flex-wrap gap-1 max-md:justify-end">
                {k.scopes.map((s) => (
                  <Badge key={s} variant="outline" className="font-mono">
                    {s}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD label="Empresas">
              {k.companyIds.length
                ? k.companyIds
                    .map(
                      (id) =>
                        companies.data?.find((company) => company.id === id)?.legal_name ?? id,
                    )
                    .join(", ")
                : "Sin asignar: configura el acceso"}
            </TD>
            <TD label="Estado">
              <StatusBadge status={k.status} label={statusLabel(k.status)} />
            </TD>
            <TD label="Último uso">
              <MutedText as="span" className="whitespace-nowrap">
                {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Nunca"}
              </MutedText>
            </TD>
            <TD actions>
              {canManage && k.status === "active" ? (
                <RowActions>
                  <ActionButton
                    size="icon-sm"
                    icon={Building2}
                    label="Asignar empresas"
                    onClick={() => onAssign(k)}
                  />
                  <ActionButton
                    size="icon-sm"
                    icon={Ban}
                    label="Revocar"
                    className="text-error-600 dark:text-error-500"
                    pending={revokingId === k.id}
                    onClick={() => onRevoke(k)}
                  />
                </RowActions>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
