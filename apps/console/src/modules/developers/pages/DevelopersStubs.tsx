import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function ApiKeysStub() {
  return (
    <div>
      <PageHeader title="API keys" description="Claves de integración máquina." />
      <EmptyState
        title="Sin API keys"
        description="Gestión de keys en consola: Sprint 11 (developers)."
      />
    </div>
  );
}

export function WebhooksStub() {
  return (
    <div>
      <PageHeader title="Webhooks" description="Suscripciones de eventos." />
      <EmptyState
        title="Sin webhooks"
        description="UI de webhooks: Sprint 11."
      />
    </div>
  );
}

export function AuditStub() {
  return (
    <div>
      <PageHeader title="Auditoría" description="Eventos de auditoría de la org." />
      <EmptyState title="Sin eventos" description="Vista de auditoría: Sprint 11." />
    </div>
  );
}

export function ValidationsStub() {
  return (
    <div>
      <PageHeader
        title="Validez CPE"
        description="Consulta de validez de comprobantes."
      />
      <EmptyState
        title="Sin consultas"
        description="Herramienta de validez CPE: Sprint 11."
      />
    </div>
  );
}
