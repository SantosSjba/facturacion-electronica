import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

import { fetchApiKeys, revokeApiKey } from "../api";
import { ApiKeysTable } from "../components/ApiKeysTable";
import { CreateApiKeyDialog } from "../components/CreateApiKeyDialog";

export function ApiKeysListPage() {
  const { hasPermission } = useSession();
  const canManage = hasPermission("apikeys:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="API keys"
        description="Claves de integración máquina. El secreto solo se muestra al crear."
        actions={
          canManage ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Nueva API key
            </Button>
          ) : null
        }
      />

      {query.isLoading ? <LoadingState label="Cargando API keys…" /> : null}

      {!query.isLoading && query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Error al cargar API keys"
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Sin API keys"
            description="Crea una clave para integrar sistemas externos."
            action={
              canManage ? (
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  Nueva API key
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ApiKeysTable
            keys={query.data ?? []}
            canManage={canManage}
            onRevoke={(id) => {
              if (window.confirm("¿Revocar esta API key?")) {
                revokeMutation.mutate(id);
              }
            }}
            revokingId={
              revokeMutation.isPending
                ? (revokeMutation.variables as string | undefined)
                : null
            }
          />
        )
      ) : null}

      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
