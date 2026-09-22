import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function DocumentsStub() {
  return (
    <div>
      <PageHeader
        title="Comprobantes"
        description="Consulta y emisión de CPE (S11)."
      />
      <EmptyState
        title="Sin comprobantes"
        description="Listados y wizards de emisión llegan en Sprint 11."
      />
    </div>
  );
}
