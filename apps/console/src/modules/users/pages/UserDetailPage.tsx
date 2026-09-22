import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button, buttonVariants } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { TextLink } from "@/shared/ui/components/text-link";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { cn } from "@/shared/ui/utils";

import { fetchOrgRoles, fetchOrgUsers, patchOrgUser, putOrgUserRoles } from "../api";
import { RolesMultiSelect } from "../components/RolesMultiSelect";
import type { UserStatus } from "../types";

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("users:write");
  const qc = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
  });
  const rolesQuery = useQuery({
    queryKey: ["org-roles"],
    queryFn: fetchOrgRoles,
  });

  const user = useMemo(
    () => (usersQuery.data ?? []).find((u) => u.id === id),
    [usersQuery.data, id],
  );

  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const displayName = name ?? user?.name ?? "";
  const displayStatus = (status ?? user?.status ?? "active") as UserStatus;
  const displayRoles = selectedRoles ?? user?.roles ?? [];

  const patchMutation = useMutation({
    mutationFn: () =>
      patchOrgUser(id ?? "", {
        name: displayName,
        status: displayStatus,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["org-users"] });
      setSaved("Perfil actualizado");
      setError(null);
    },
    onError: (err) => {
      setSaved(null);
      setError(err instanceof ApiError ? err.message : "Error al actualizar");
    },
  });

  const rolesMutation = useMutation({
    mutationFn: () => putOrgUserRoles(id ?? "", displayRoles),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["org-users"] });
      setSaved("Roles actualizados");
      setError(null);
    },
    onError: (err) => {
      setSaved(null);
      setError(err instanceof ApiError ? err.message : "Error al asignar roles");
    },
  });

  if (usersQuery.isLoading || rolesQuery.isLoading) {
    return <LoadingState label="Cargando usuario…" />;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="No encontrado"
          message="Usuario no existe en la organización."
        />
        <TextLink
          to="/users"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Volver a usuarios
        </TextLink>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={user.email}
        description="Detalle de usuario — editar nombre, estado y roles."
        actions={
          <TextLink to="/users" className="text-sm">
            ← Volver
          </TextLink>
        }
      />

      <div className="max-w-xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user.email} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-name">Nombre</Label>
          <Input
            id="detail-name"
            value={displayName}
            disabled={!canWrite}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-status">Estado</Label>
          <Select
            id="detail-status"
            value={displayStatus}
            disabled={!canWrite}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </Select>
        </div>

        {canWrite ? (
          <Button
            type="button"
            onClick={() => patchMutation.mutate()}
            disabled={patchMutation.isPending}
          >
            {patchMutation.isPending ? "Guardando…" : "Guardar perfil"}
          </Button>
        ) : null}

        <RolesMultiSelect
          roles={rolesQuery.data ?? []}
          value={displayRoles}
          onChange={setSelectedRoles}
          disabled={!canWrite}
        />

        {canWrite ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => rolesMutation.mutate()}
            disabled={rolesMutation.isPending || displayRoles.length < 1}
          >
            {rolesMutation.isPending ? "Actualizando roles…" : "Guardar roles"}
          </Button>
        ) : null}

        {error ? <ErrorState title="Error" message={error} /> : null}
        {saved ? (
          <p className="text-sm text-success-600 dark:text-success-500" role="status">
            {saved}
          </p>
        ) : null}
      </div>
    </div>
  );
}
