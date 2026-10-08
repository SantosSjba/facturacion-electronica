import { formatDateTime } from "@/shared/ui/display-labels";
import { CertificateBadge, EnvironmentBadge, StatusBadge } from "@/shared/ui/status-badge";
import { ActionLink } from "@/shared/ui/components/action-link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Hash, KeyRound, Power, Truck } from "lucide-react";

import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  Badge,
  ConfirmDialog,
  EntityCell,
  MutedText,
  RowActions,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  initialsOf,
} from "@factosys/ui";

import { TextLink } from "@/shared/ui/components/text-link";

import { patchCompany } from "../api";
import type { Company, CompanyStatus } from "../types";

export function CompaniesTable({ companies }: { companies: Company[] }) {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const qc = useQueryClient();
  const [pending, setPending] = useState<Company | null>(null);
  const pendingActive = (pending?.status ?? "active") === "active";

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CompanyStatus }) =>
      patchCompany(id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setPending(null);
    },
  });

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Empresa</TH>
            <TH>Ambiente</TH>
            <TH>Estado</TH>
            <TH>Certificado</TH>
            <TH>Credenciales</TH>
            <TH>Actualizado</TH>
            <TH className="text-end">Acciones</TH>
          </TR>
        </THead>
        <TBody>
          {companies.map((c) => {
            const active = (c.status ?? "active") === "active";
            return (
              <TR key={c.id}>
                <TD label="Empresa">
                  <EntityCell
                    initials={initialsOf(c.legal_name, c.ruc)}
                    tone={active ? "brand" : "muted"}
                    title={
                      <TextLink to={`/app/companies/${c.id}/overview`}>{c.legal_name}</TextLink>
                    }
                    subtitle={
                      <>
                        <Hash aria-hidden />
                        <span className="font-mono">{c.ruc}</span>
                      </>
                    }
                  />
                </TD>
                <TD label="Ambiente">
                  <EnvironmentBadge environment={c.environment} />
                </TD>
                <TD label="Estado">
                  <StatusBadge
                    status={active ? "active" : "disabled"}
                    label={active ? "Activa" : "Deshabilitada"}
                  />
                </TD>
                <TD label="Certificado">
                  <CertificateBadge status={c.certificate_status} />
                </TD>
                <TD label="Credenciales">
                  <div className="flex flex-wrap gap-1 max-md:justify-end md:flex-nowrap">
                    <Badge
                      color={c.sol_configured ? "success" : "outline"}
                      title={c.sol_configured ? "SOL configurado" : "SOL pendiente"}
                    >
                      <KeyRound className="size-3 shrink-0" aria-hidden />
                      SOL
                    </Badge>
                    <Badge
                      color={c.gre_configured ? "success" : "outline"}
                      title={c.gre_configured ? "GRE configurado" : "GRE pendiente"}
                    >
                      <Truck className="size-3 shrink-0" aria-hidden />
                      GRE
                    </Badge>
                  </div>
                </TD>
                <TD label="Actualizado">
                  <MutedText as="span" className="whitespace-nowrap">
                    {formatDateTime(c.updated_at)}
                  </MutedText>
                </TD>
                <TD actions>
                  <RowActions>
                    <ActionLink
                      size="icon-sm"
                      to={`/app/companies/${c.id}/overview`}
                      icon={Eye}
                      label="Ver detalle"
                    />
                    {canWrite ? (
                      <ActionButton
                        size="icon-sm"
                        icon={Power}
                        label={active ? "Dar de baja" : "Reactivar"}
                        onClick={() => setPending(c)}
                      />
                    ) : null}
                  </RowActions>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pendingActive ? "Dar de baja empresa" : "Reactivar empresa"}
        description={
          pendingActive
            ? "No podrá emitir comprobantes hasta que la reactives. El historial se conserva."
            : "La empresa volverá a estar disponible para emisión."
        }
        confirmLabel={pendingActive ? "Dar de baja" : "Reactivar"}
        confirmIcon={Power}
        tone={pendingActive ? "destructive" : "primary"}
        pending={mutation.isPending}
        error={
          mutation.error
            ? mutation.error instanceof Error
              ? mutation.error.message
              : "No se pudo actualizar"
            : null
        }
        onConfirm={() => {
          if (!pending) return;
          const next: CompanyStatus = pendingActive ? "disabled" : "active";
          mutation.mutate({ id: pending.id, status: next });
        }}
        onClose={() => {
          mutation.reset();
          setPending(null);
        }}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {pending?.legal_name} <span className="font-mono text-theme-xs">({pending?.ruc})</span>
        </p>
      </ConfirmDialog>
    </>
  );
}
