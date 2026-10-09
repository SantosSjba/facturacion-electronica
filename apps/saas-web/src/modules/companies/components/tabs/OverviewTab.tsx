import { certificateLabel, formatDateTime } from "@/shared/ui/display-labels";
import { EnvironmentBadge, StatusBadge } from "@/shared/ui/status-badge";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  Clock,
  Fingerprint,
  Hash,
  KeyRound,
  MapPin,
  MapPinned,
  Pencil,
  Power,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  Badge,
  ConfirmDialog,
  InfoField,
  InfoGrid,
  SectionCard,
  StatCard,
} from "@factosys/ui";

import { patchCompany } from "../../api";
import type { Company, CompanyStatus } from "../../types";
import { CompanyLogoCard } from "../CompanyLogoCard";

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

  const formatMutation = useMutation({
    mutationFn: (pdf_format: NonNullable<Company["pdf_format"]>) =>
      patchCompany(company.id, { pdf_format }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      await qc.invalidateQueries({ queryKey: ["company", company.id] });
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
          <EnvironmentBadge environment={company.environment} />
          <StatusBadge
            status={active ? "active" : "disabled"}
            label={active ? "Activa" : "Deshabilitada"}
          />
          <Badge color={certOk ? "success" : "muted"}>
            <ShieldCheck className="size-3 shrink-0" aria-hidden />
            Certificado: {certificateLabel(company.certificate_status)}
          </Badge>
          <Badge color={company.sol_configured ? "success" : "muted"}>
            <KeyRound className="size-3 shrink-0" aria-hidden />
            SOL {company.sol_configured ? "listo" : "pendiente"}
          </Badge>
          <Badge color={company.gre_configured ? "success" : "muted"}>
            <Truck className="size-3 shrink-0" aria-hidden />
            GRE {company.gre_configured ? "listo" : "pendiente"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canWrite ? (
            <ActionButton
              icon={Power}
              label={active ? "Dar de baja" : "Reactivar"}
              onClick={() => setConfirmOpen(true)}
            />
          ) : null}
          {canWrite && onEdit ? (
            <ActionButton icon={Pencil} label="Editar empresa" onClick={onEdit} />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={active ? "Dar de baja empresa" : "Reactivar empresa"}
        description={
          active
            ? "No podrá emitir comprobantes hasta que la reactives."
            : "La empresa volverá a estar disponible para emisión."
        }
        confirmLabel={active ? "Dar de baja" : "Reactivar"}
        confirmIcon={Power}
        tone={active ? "destructive" : "primary"}
        pending={statusMutation.isPending}
        error={
          statusMutation.error
            ? statusMutation.error instanceof Error
              ? statusMutation.error.message
              : "Error"
            : null
        }
        onConfirm={() => statusMutation.mutate(active ? "disabled" : "active")}
        onClose={() => {
          statusMutation.reset();
          setConfirmOpen(false);
        }}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShieldCheck}
          label="Certificado"
          value={certificateLabel(company.certificate_status)}
          tone={certOk ? "success" : "muted"}
        />
        <StatCard
          icon={KeyRound}
          label="Clave SOL"
          value={company.sol_configured ? "Configurado" : "Sin configurar"}
          tone={company.sol_configured ? "success" : "muted"}
        />
        <StatCard
          icon={Truck}
          label="GRE"
          value={company.gre_configured ? "Configurado" : "Sin configurar"}
          tone={company.gre_configured ? "success" : "muted"}
        />
        <StatCard
          icon={Fingerprint}
          label="Reglas de validación"
          value={company.catalog_pin?.ruleset ?? "Predeterminado de la plataforma"}
          tone={company.catalog_pin?.ruleset ? "success" : "muted"}
          mono
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={Building2} title="Identidad">
          <InfoGrid>
            <InfoField icon={Hash} label="RUC" value={company.ruc} mono />
            <InfoField icon={Building2} label="Razón social" value={company.legal_name} />
            <InfoField icon={Store} label="Nombre comercial" value={company.trade_name?.trim()} />
            <InfoField icon={Clock} label="Zona horaria" value={company.timezone} mono />
          </InfoGrid>
        </SectionCard>

        <SectionCard icon={MapPin} tone="neutral" title="Domicilio y registro">
          <InfoGrid>
            <InfoField icon={MapPin} label="Dirección" value={addressLine} />
            <InfoField icon={MapPinned} label="Ubigeo" value={ubigeo} mono />
            <InfoField
              icon={CalendarPlus}
              label="Creado"
              value={formatDateTime(company.created_at)}
            />
            <InfoField
              icon={CalendarClock}
              label="Actualizado"
              value={formatDateTime(company.updated_at)}
            />
          </InfoGrid>
        </SectionCard>
      </section>
      <SectionCard icon={Building2} title="Formato de impresión">
        <label htmlFor="company-pdf-format">Formato predeterminado para nuevos comprobantes</label>
        <select
          id="company-pdf-format"
          className="mt-2 block rounded-md border bg-background p-2"
          value={company.pdf_format ?? "A4"}
          disabled={!canWrite || formatMutation.isPending}
          onChange={(event) =>
            formatMutation.mutate(event.target.value as NonNullable<Company["pdf_format"]>)
          }
        >
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="TICKET80">Ticket de 80 mm</option>
          <option value="TICKET58">Ticket de 58 mm</option>
        </select>
        <p className="mt-2 text-sm text-muted-foreground">
          Los documentos emitidos conservan su formato. Puedes elegir otro formato al emitir
          mediante la API.
        </p>
        {formatMutation.error ? <p role="alert">{formatMutation.error.message}</p> : null}
      </SectionCard>
      <CompanyLogoCard key={company.id} company={company} />
    </div>
  );
}
