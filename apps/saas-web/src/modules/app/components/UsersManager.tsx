import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { z } from "zod";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Badge,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Input,
  Label,
  MultiSelect,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from "@factosys/ui";
import {
  createOrgUser,
  fetchOrgRoles,
  fetchOrgUsers,
  updateOrgUser,
  type OrgUser,
} from "../api/users";
import { useSession } from "@/shared/auth/session-context";
import { getErrorMessage } from "@/shared/api/errors";
import { usePlanCapacity } from "@/shared/plan/use-plan-capacity";
import { PlanCapacityNotice } from "@/shared/plan/PlanCapacityNotice";

const schema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
  name: z.string().trim().min(2, "Ingresa el nombre").max(120),
  roles: z.array(z.string()).min(1, "Selecciona al menos un rol"),
});

/** The owner and platform use the same form, table, validation and quota notice. */
export function UsersManager({ organizationId }: { organizationId?: string }) {
  const { user, hasPermission } = useSession();
  const platform = Boolean(organizationId);
  const canRead = hasPermission(platform ? "platform:admin" : "users:read");
  const canWrite = hasPermission(platform ? "platform:admin" : "users:write");
  const canAssignOwner = platform || Boolean(user?.roles.includes("owner"));
  const qc = useQueryClient();
  const capacity = usePlanCapacity("users", canWrite, organizationId);
  const usersKey = ["org-users", organizationId ?? user?.organizationId];
  const usersQuery = useQuery({
    queryKey: usersKey,
    queryFn: () => fetchOrgUsers(organizationId),
    enabled: canRead,
  });
  const rolesQuery = useQuery({
    queryKey: ["org-roles", organizationId ?? user?.organizationId],
    queryFn: () => fetchOrgRoles(organizationId),
    enabled: canRead,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(["admin"]);
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function show(target: OrgUser | null) {
    setEditing(target);
    setName(target?.name ?? "");
    setEmail(target?.email ?? "");
    setPassword("");
    setRoles(target?.roles ?? ["admin"]);
    setStatus(target?.status === "disabled" ? "disabled" : "active");
    setErrors({});
    setOpen(true);
  }
  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      password: string;
      roles: string[];
    }) =>
      editing
        ? updateOrgUser(
            editing.id,
            {
              name: input.name,
              roles: input.roles,
              status,
              ...(input.password ? { password: input.password } : {}),
            },
            organizationId,
          )
        : createOrgUser(input, organizationId),
    onSuccess: async () => {
      toast.success(editing ? "Usuario actualizado" : "Usuario creado");
      setOpen(false);
      setPassword("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: usersKey }),
        qc.invalidateQueries({ queryKey: ["org-plan"] }),
      ]);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "No se pudo guardar el usuario"));
      void qc.invalidateQueries({ queryKey: ["org-plan"] });
    },
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending || (!editing && capacity.blocked)) return;
    const parsed = schema.safeParse({ name, email, roles });
    const next = parsed.success
      ? {}
      : Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        );
    if ((!editing || password) && password.length < 8)
      next.password = "La contraseña debe tener al menos 8 caracteres";
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) return;
    mutation.mutate({ ...parsed.data, password });
  }
  if (!canRead) return <ErrorState message="No tienes permiso para administrar usuarios." />;
  const loading = usersQuery.isLoading || rolesQuery.isLoading;
  const error = usersQuery.error || rolesQuery.error;
  return (
    <div className="space-y-6">
      <PageHeader
        title={platform ? "Usuarios de la organización" : "Usuarios"}
        description="Gestiona los accesos y roles de tu equipo."
        actions={
          canWrite ? (
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Crear usuario"
              disabled={capacity.blocked}
              onClick={() => show(null)}
            >
              <Plus className={buttonIconClassName} />
              <ButtonLabel>Crear usuario</ButtonLabel>
            </Button>
          ) : null
        }
      />
      {canWrite ? <PlanCapacityNotice capacity={capacity} platform={platform} /> : null}
      {loading ? (
        <LoadingState variant="table" label="Cargando usuarios…" />
      ) : error ? (
        <ErrorState
          message={getErrorMessage(error, "No se pudieron cargar los usuarios")}
          onRetry={() => {
            void usersQuery.refetch();
            void rolesQuery.refetch();
          }}
        />
      ) : usersQuery.data?.length ? (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Correo</TH>
              <TH>Roles</TH>
              <TH>Estado</TH>
              {canWrite ? <TH>Acciones</TH> : null}
            </TR>
          </THead>
          <TBody>
            {usersQuery.data.map((u) => (
              <TR key={u.id}>
                <TD label="Nombre">{u.name}</TD>
                <TD label="Correo">{u.email}</TD>
                <TD label="Roles">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {rolesQuery.data?.find((r) => r.code === role)?.name ?? role}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD label="Estado">
                  <Badge variant={u.status === "active" ? "success" : "warning"}>
                    {u.status === "active" ? "Activo" : "Desactivado"}
                  </Badge>
                </TD>
                {canWrite ? (
                  <TD label="Acciones">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Editar usuario ${u.email}`}
                      onClick={() => show(u)}
                      disabled={u.roles.some((r) => r.startsWith("platform_"))}
                    >
                      Editar
                    </Button>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState title="Sin usuarios" description="Crea un usuario para tu equipo." />
      )}
      <Dialog
        open={open}
        onClose={() => {
          if (!mutation.isPending) {
            setOpen(false);
            setPassword("");
          }
        }}
        ariaLabel={editing ? "Editar usuario" : "Crear usuario"}
        size="md"
        closeOnBackdrop={!mutation.isPending}
      >
        <form onSubmit={submit} noValidate>
          <DialogHeader
            title={editing ? "Editar usuario" : "Crear usuario"}
            description={
              editing
                ? "Actualiza sus datos, roles y acceso."
                : "El usuario podrá iniciar sesión con este correo y contraseña."
            }
          />
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-name">Nombre</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              <FieldError message={errors.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Correo electrónico</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                disabled={Boolean(editing)}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              <FieldError message={errors.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-password">
                {editing ? "Nueva contraseña (opcional)" : "Contraseña"}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
              />
              <FieldError message={errors.password} />
            </div>
            <MultiSelect
              label="Roles"
              options={(rolesQuery.data ?? [])
                .filter((r) => canAssignOwner || r.code !== "owner" || roles.includes("owner"))
                .map((r) => ({ value: r.code, text: r.name }))}
              value={roles}
              onChange={setRoles}
            />
            <FieldError message={errors.roles} />
            {editing ? (
              <div className="space-y-1.5">
                <Label htmlFor="user-status">Estado</Label>
                <Select
                  id="user-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
                >
                  <option value="active">Activo</option>
                  <option value="disabled">Desactivado</option>
                </Select>
              </div>
            ) : (
              <PlanCapacityNotice capacity={capacity} platform={platform} />
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setOpen(false);
                setPassword("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={!editing && capacity.blocked}
            >
              {editing ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
