import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Shield } from "lucide-react";

import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/shared/ui/Pagination";
import { cn } from "@/shared/ui/utils";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [filters, pageSize]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

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
              className={cn(
                buttonVariants({ variant: "outline", size: "icon-label-sm" }),
              )}
              aria-label="Matriz de permisos"
            >
              <Shield className={buttonIconClassName} />
              <ButtonLabel>Matriz de permisos</ButtonLabel>
            </Link>
            {canWrite ? (
              <Button
                type="button"
                size="icon-label-sm"
                aria-label="Invitar / crear"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className={buttonIconClassName} />
                <ButtonLabel>Invitar / crear</ButtonLabel>
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
            <>
              <UsersTable users={visible} />
              <Pagination
                page={page}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
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
