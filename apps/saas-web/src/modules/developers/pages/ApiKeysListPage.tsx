import { usePlanCapacity } from "@/shared/plan/use-plan-capacity";
import { PlanCapacityNotice } from "@/shared/plan/PlanCapacityNotice";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, KeyRound, Plus } from "lucide-react";

import { getErrorMessage } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@factosys/ui";

import { fetchApiKeys, revokeApiKey } from "../api";
import type { ApiKey } from "../types";
import { ApiKeysTable } from "../components/ApiKeysTable";
import { CreateApiKeyDialog } from "../components/CreateApiKeyDialog";
import { AssignApiKeyCompaniesDialog } from "../components/AssignApiKeyCompaniesDialog";

export function ApiKeysListPage() {
  const { hasPermission } = useSession();
  const canManage = hasPermission("apikeys:manage");
  const capacity = usePlanCapacity("api_keys", canManage);
  const [createOpen, setCreateOpen] = useState(false);
  const [assigning, setAssigning] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      setRevoking(null);
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
      await qc.invalidateQueries({ queryKey: ["org-plan"] });
    },
  });

  const createButton = canManage ? (
    <ActionButton
      variant="primary"
      icon={Plus}
      label="Nueva API key"
      disabled={capacity.blocked}
      onClick={() => setCreateOpen(true)}
    />
  ) : null;

  return (
    <div>
      <PageHeader
        icon={KeyRound}
        title="API keys"
        description="Claves de integración máquina. El secreto solo se muestra al crear."
        actions={createButton}
      />

      <div className="mb-6">
        <PlanCapacityNotice capacity={capacity} />
      </div>

      {query.isLoading ? <LoadingState variant="table" label="Cargando API keys…" /> : null}

      {!query.isLoading && query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Error al cargar API keys"}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Sin API keys"
            description="Crea una clave para integrar sistemas externos."
            action={createButton ?? undefined}
          />
        ) : (
          <ApiKeysTable
            keys={query.data ?? []}
            canManage={canManage}
            onAssign={setAssigning}
            onRevoke={(key) => {
              revokeMutation.reset();
              setRevoking(key);
            }}
            revokingId={
              revokeMutation.isPending ? (revokeMutation.variables as string | undefined) : null
            }
          />
        )
      ) : null}

      <CreateApiKeyDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {assigning ? (
        <AssignApiKeyCompaniesDialog
          key={assigning.id}
          apiKey={assigning}
          onClose={() => setAssigning(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(revoking)}
        title="Revocar API key"
        description="Las integraciones que usen esta clave dejarán de funcionar de inmediato. No se puede deshacer."
        confirmLabel="Revocar"
        confirmIcon={Ban}
        tone="destructive"
        pending={revokeMutation.isPending}
        error={revokeMutation.error ? getErrorMessage(revokeMutation.error) : null}
        onConfirm={() => {
          if (revoking) revokeMutation.mutate(revoking.id);
        }}
        onClose={() => setRevoking(null)}
      >
        {revoking ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {revoking.name}{" "}
            <code className="font-mono text-theme-xs text-gray-500">({revoking.keyPrefix}…)</code>
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
