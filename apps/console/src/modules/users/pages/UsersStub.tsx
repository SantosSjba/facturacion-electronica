import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function UsersStub() {
  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios y roles (S10-RBAC-UI)."
      />
      <EmptyState
        title="Sin usuarios listados"
        description="La pantalla de usuarios se implementa en el epic S10-RBAC-UI."
      />
    </div>
  );
}
