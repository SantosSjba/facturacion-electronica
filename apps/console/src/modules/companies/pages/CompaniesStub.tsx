import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function CompaniesStub() {
  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Onboarding de empresas y credenciales (S10-EMP)."
      />
      <EmptyState
        title="Sin empresas todavía"
        description="La lista y el alta de empresas se implementan en el epic S10-EMP."
      />
    </div>
  );
}
