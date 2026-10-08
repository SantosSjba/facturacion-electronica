import { Spinner } from "@factosys/ui";
import type { ComponentType } from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  CheckCircle2,
  CircleOff,
  Fingerprint,
  KeyRound,
  Pencil,
  Power,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";

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
  Card,
  CardTitle,
  MutedText,
  cn,
} from "@factosys/ui";

import { patchCompany } from "../../api";
import type { Company, CompanyStatus } from "../../types";

export function OverviewTab() {
  const { company, onEdit } = useOutletContext<{
    company: Company;
    onEdit?: () => void;
  }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = (company.status ?? "active") === "active";

  const statusMutation = useMutation({
    mutationFn: (status: CompanyStatus) => patchCompany(company.id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      await qc.invalidateQueries({ queryKey: ["company", company.id] });
      setConfirmOpen(false);
    },
  });

  const certOk = company.certificate_status === "active";
  const address = (company.address ?? {}) as Record<string, unknown>;
  const addressLine = typeof address.line === "string" && address.line.trim() ? address.line : null;
  const ubigeo =
    typeof address.ubigeo === "string" && address.ubigeo.trim() ? address.ubigeo : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={company.environment === "production" ? "warning" : "primary"}>
            {company.environment}
          </Badge>
          <Badge variant={active ? "success" : "muted"} className="gap-1">
            {active ? (
              <CheckCircle2 className="size-3" aria-hidden />
            ) : (
              <CircleOff className="size-3" aria-hidden />
            )}
            {active ? "Activa" : "Deshabilitada"}
          </Badge>
          <Badge variant={certOk ? "success" : "muted"}>Cert: {company.certificate_status}</Badge>
          <Badge variant={company.sol_configured ? "success" : "muted"}>
            SOL {company.sol_configured ? "listo" : "pendiente"}
          </Badge>
          <Badge variant={company.gre_configured ? "success" : "muted"}>
            GRE {company.gre_configured ? "listo" : "pendiente"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              size="icon-label-sm"
              aria-label={active ? "Dar de baja" : "Reactivar"}
              onClick={() => setConfirmOpen(true)}
            >
              <Power className={buttonIconClassName} />
              <ButtonLabel>{active ? "Dar de baja" : "Reactivar"}</ButtonLabel>
            </Button>
          ) : null}
          {canWrite && onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="icon-label-sm"
              aria-label="Editar metadatos"
              onClick={onEdit}
            >
              <Pencil className={buttonIconClassName} />
              <ButtonLabel>Editar metadatos</ButtonLabel>
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!statusMutation.isPending) setConfirmOpen(false);
        }}
        ariaLabel="Confirmar estado de empresa"
        size="sm"
      >
        <DialogHeader
          title={active ? "Dar de baja empresa" : "Reactivar empresa"}
          description={
            active
              ? "No podrá emitir comprobantes hasta que la reactives."
              : "La empresa volverá a estar disponible para emisión."
          }
          onClose={() => {
            if (!statusMutation.isPending) setConfirmOpen(false);
          }}
        />
        <DialogBody>
          {statusMutation.error ? (
            <p className="text-sm text-error-600 dark:text-error-500">
              {statusMutation.error instanceof Error ? statusMutation.error.message : "Error"}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={statusMutation.isPending}
            onClick={() => setConfirmOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(active ? "disabled" : "active")}
          >
            {statusMutation.isPending ? (
              <Spinner className={`${buttonIconClassName}`} />
            ) : (
              <Power className={buttonIconClassName} />
            )}
            <ButtonLabel>{active ? "Dar de baja" : "Reactivar"}</ButtonLabel>
          </Button>
        </DialogFooter>
      </Dialog>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={ShieldCheck}
          label="Certificado"
          value={company.certificate_status}
          ok={certOk}
        />
        <StatusCard
          icon={KeyRound}
          label="Clave SOL"
          value={company.sol_configured ? "Configurado" : "Sin configurar"}
          ok={company.sol_configured}
        />
        <StatusCard
          icon={Truck}
          label="GRE"
          value={company.gre_configured ? "Configurado" : "Sin configurar"}
          ok={company.gre_configured}
        />
        <StatusCard
          icon={Fingerprint}
          label="Ruleset pin"
          value={company.catalog_pin?.ruleset ?? "Platform default"}
          ok={Boolean(company.catalog_pin?.ruleset)}
          mono
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
              <Building2 className="size-4" />
            </span>
            <CardTitle className="mb-0">Identidad</CardTitle>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="RUC" value={company.ruc} mono />
            <Field label="Razón social" value={company.legal_name} />
            <Field label="Nombre comercial" value={company.trade_name?.trim() || "—"} />
            <Field label="Timezone" value={company.timezone || "—"} mono />
          </dl>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">
              <Calendar className="size-4" />
            </span>
            <CardTitle className="mb-0">Domicilio y registro</CardTitle>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Dirección" value={addressLine ?? "—"} />
            <Field label="Ubigeo" value={ubigeo ?? "—"} mono />
            <Field label="Creado" value={new Date(company.created_at).toLocaleString()} />
            <Field label="Actualizado" value={new Date(company.updated_at).toLocaleString()} />
          </dl>
        </Card>
      </section>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  ok,
  mono,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  ok: boolean;
  mono?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            ok
              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
              : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <MutedText className="text-xs uppercase tracking-wide">{label}</MutedText>
          <p
            className={cn(
              "mt-0.5 truncate text-sm font-semibold text-gray-800 dark:text-white/90",
              mono && "font-mono text-xs",
            )}
            title={value}
          >
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <MutedText as="dt" className="text-xs uppercase tracking-wide">
        {label}
      </MutedText>
      <dd
        className={cn(
          "mt-0.5 text-sm font-medium text-gray-800 dark:text-white/90",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
