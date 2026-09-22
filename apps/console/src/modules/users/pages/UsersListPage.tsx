import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

import { fetchOrgRoles, fetchOrgUsers } from "../api";
import { CreateUserDialog } from "../components/CreateUserDialog";
import { UserFilters } from "../components/UserFilters";
import { UsersTable } from "../components/UsersTable";
import { filterUsers, type UserFiltersState } from "../filters";

export function UsersListPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("users:write");
  const [filters, setFilters] = useState<UserFiltersState>({
    email: "",
    role: "",
    status: "",
  });
  const [createOpen, setCreateOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
  });
  const rolesQuery = useQuery({
    queryKey: ["org-roles"],
    queryFn: fetchOrgRoles,
  });

  const filtered = useMemo(
    () => filterUsers(usersQuery.data ?? [], filters),
    [usersQuery.data, filters],
  );

  const loading = usersQuery.isLoading || rolesQuery.isLoading;
  const error = usersQuery.error || rolesQuery.error;

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Administración de usuarios y roles de la organización."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/users/permissions"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-medium hover:bg-[var(--muted)]"
            >
              <Shield className="h-4 w-4" />
              Matriz de permisos
            </Link>
            {canWrite ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                Invitar / crear
              </Button>
            ) : null}
          </div>
        }
      />

      {loading ? <LoadingState label="Cargando usuarios…" /> : null}

      {!loading && error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Error al cargar usuarios"
          }
          onRetry={() => {
            void usersQuery.refetch();
            void rolesQuery.refetch();
          }}
        />
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <UserFilters
            value={filters}
            onChange={setFilters}
            roles={rolesQuery.data ?? []}
          />
          {filtered.length === 0 ? (
            <EmptyState
              title="Sin usuarios"
              description="No hay usuarios que coincidan con los filtros."
            />
          ) : (
            <UsersTable users={filtered} />
          )}
        </div>
      ) : null}

      {canWrite ? (
        <CreateUserDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          roles={rolesQuery.data ?? []}
        />
      ) : null}
    </div>
  );
}
