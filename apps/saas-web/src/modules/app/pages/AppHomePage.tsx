import { Building2, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { fetchOnboardingStatus } from "@/modules/app/api/onboarding";
import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function AppHomePage() {
  const { user, logout } = useSession();
  const statusQuery = useQuery({
    queryKey: ["onboarding-status", user?.organizationId],
    queryFn: fetchOnboardingStatus,
    enabled: Boolean(user),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Panel"
        description="Inicio del panel cliente (S15-APP ampliará home, users, plan y notificaciones)."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void logout()}
          >
            <LogOut className={buttonIconClassName} />
            <ButtonLabel>Salir</ButtonLabel>
          </Button>
        }
      />

      {statusQuery.isLoading ? (
        <LoadingState label="Cargando…" />
      ) : (
        <Card className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Building2 className="size-6" />
          </div>
          <CardTitle>
            Bienvenido
            {statusQuery.data?.organization_name
              ? ` — ${statusQuery.data.organization_name}`
              : ""}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Onboarding completo. Esta es la entrada a <code>/app</code> para tu
            organización
            {statusQuery.data?.organization_slug
              ? ` (${statusQuery.data.organization_slug})`
              : ""}
            .
          </p>
        </Card>
      )}
    </div>
  );
}
