import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function GreStub() {
  return (
    <div>
      <PageHeader title="GRE" description="Guías de remisión electrónica (S11)." />
      <EmptyState
        title="Sin guías"
        description="El módulo GRE en consola se completa en Sprint 11."
      />
    </div>
  );
}
