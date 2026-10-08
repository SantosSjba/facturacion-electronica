import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  CircleOff,
  Loader2,
  Power,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { useSession } from "@/shared/auth/session-context";
import {
  Badge,
  Button,
  ButtonLabel,
  buttonIconClassName,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  MutedText,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  cn,
} from "@factosys/ui";

import { TextLink } from "@/shared/ui/components/text-link";

import { patchCompany } from "../api";
import type { Company, CompanyStatus } from "../types";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function companyInitials(legalName: string, ruc: string): string {
  const words = legalName
    .trim()
    .split(/\s+/)
    .filter(
      (w) => w.length > 1 && !/^(S\.?A\.?|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?|SAC|SRL|EIRL|SA)$/i.test(w),
    );
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  if (words[0] && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return ruc.slice(0, 2) || "?";
}

export function CompaniesTable({ companies }: { companies: Company[] }) {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const qc = useQueryClient();
  const [pending, setPending] = useState<Company | null>(null);

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
            {canWrite ? <TH /> : null}
          </TR>
        </THead>
        <TBody>
          {companies.map((c) => {
            const certOk = c.certificate_status === "active";
            const active = (c.status ?? "active") === "active";
            return (
              <TR key={c.id}>
                <TD label="Empresa">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                        active
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                          : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
                      )}
                      aria-hidden
                    >
                      {companyInitials(c.legal_name, c.ruc)}
                    </span>
                    <div className="min-w-0">
                      <TextLink to={`/app/companies/${c.id}/overview`} className="block truncate">
                        {c.legal_name}
                      </TextLink>
                      <MutedText
                        as="span"
                        className="mt-0.5 flex items-center gap-1 font-mono text-theme-xs"
                      >
                        <Building2 className="size-3 shrink-0" aria-hidden />
                        {c.ruc}
                      </MutedText>
                    </div>
                  </div>
                </TD>
                <TD label="Ambiente">
                  <Badge variant={c.environment === "production" ? "warning" : "primary"}>
                    {c.environment}
                  </Badge>
                </TD>
                <TD label="Estado">
                  <Badge variant={active ? "success" : "muted"} className="gap-1">
                    {active ? (
                      <CheckCircle2 className="size-3" aria-hidden />
                    ) : (
                      <CircleOff className="size-3" aria-hidden />
                    )}
                    {active ? "Activa" : "Deshabilitada"}
                  </Badge>
                </TD>
                <TD label="Certificado">
                  <Badge variant={certOk ? "success" : "muted"} className="gap-1">
                    {certOk ? (
                      <ShieldCheck className="size-3" aria-hidden />
                    ) : (
                      <ShieldAlert className="size-3" aria-hidden />
                    )}
                    {c.certificate_status}
                  </Badge>
                </TD>
                <TD label="Credenciales">
                  <div className="flex flex-wrap gap-1 max-md:justify-end">
                    <Badge variant={c.sol_configured ? "success" : "outline"}>SOL</Badge>
                    <Badge variant={c.gre_configured ? "success" : "outline"}>GRE</Badge>
                  </div>
                </TD>
                <TD label="Actualizado">
                  <MutedText as="span">{formatDate(c.updated_at)}</MutedText>
                </TD>
                {canWrite ? (
                  <TD actions>
                    <Button
                      type="button"
                      size="icon-label-sm"
                      variant="outline"
                      aria-label={active ? "Dar de baja" : "Reactivar"}
                      onClick={() => setPending(c)}
                    >
                      <Power className={buttonIconClassName} />
                      <ButtonLabel>{active ? "Dar de baja" : "Reactivar"}</ButtonLabel>
                    </Button>
                  </TD>
                ) : null}
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Dialog
        open={Boolean(pending)}
        onClose={() => {
          if (!mutation.isPending) setPending(null);
        }}
        ariaLabel="Confirmar estado de empresa"
        size="sm"
      >
        <DialogHeader
          title={
            (pending?.status ?? "active") === "active" ? "Dar de baja empresa" : "Reactivar empresa"
          }
          description={
            (pending?.status ?? "active") === "active"
              ? "No podrá emitir comprobantes hasta que la reactives. El historial se conserva."
              : "La empresa volverá a estar disponible para emisión."
          }
          onClose={() => {
            if (!mutation.isPending) setPending(null);
          }}
        />
        <DialogBody>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {pending?.legal_name} <span className="font-mono text-theme-xs">({pending?.ruc})</span>
          </p>
          {mutation.error ? (
            <p className="mt-2 text-sm text-error-600 dark:text-error-500">
              {mutation.error instanceof Error ? mutation.error.message : "No se pudo actualizar"}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setPending(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || !pending}
            onClick={() => {
              if (!pending) return;
              const next: CompanyStatus =
                (pending.status ?? "active") === "active" ? "disabled" : "active";
              mutation.mutate({ id: pending.id, status: next });
            }}
          >
            {mutation.isPending ? (
              <Loader2 className={`${buttonIconClassName} animate-spin`} />
            ) : (
              <Power className={buttonIconClassName} />
            )}
            <ButtonLabel>
              {(pending?.status ?? "active") === "active" ? "Dar de baja" : "Reactivar"}
            </ButtonLabel>
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
