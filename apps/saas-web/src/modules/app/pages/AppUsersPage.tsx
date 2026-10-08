import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { fetchOrgRoles, fetchOrgUsers, inviteOrgUser, type OrgUser } from "@/modules/app/api/users";
import { useSession } from "@/shared/auth/session-context";
import { ApiError } from "@/shared/api/errors";
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
} from "@factosys/ui";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nombre muy corto").max(120),
  roles: z.array(z.string().min(1)).min(1, "Selecciona al menos un rol"),
});

function statusBadge(status: string) {
  if (status === "active") return <Badge variant="success">Activo</Badge>;
  if (status === "disabled") return <Badge variant="warning">Pendiente invite</Badge>;
  return <Badge variant="muted">{status}</Badge>;
}

export function AppUsersPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("users:write");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>(["admin"]);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
  });
  const rolesQuery = useQuery({
    queryKey: ["org-roles"],
    queryFn: fetchOrgRoles,
  });

  const assignableRoles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.code !== "owner"),
    [rolesQuery.data],
  );

  const parsed = inviteSchema.safeParse({ email, name, roles });
  const fieldErrors = parsed.success
    ? {}
    : (Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ) as Partial<Record<"email" | "name" | "roles", string>>);

  const inviteMutation = useMutation({
    mutationFn: inviteOrgUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["org-users"] });
      void queryClient.invalidateQueries({ queryKey: ["org-notifications"] });
      toast.success("Invitación enviada");
      setOpen(false);
      setEmail("");
      setName("");
      setRoles(["admin"]);
      setTouched(false);
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
      else if (err instanceof Error) setFormError(err.message);
      else setFormError("No se pudo enviar la invitación");
    },
  });

  function submit() {
    setTouched(true);
    setFormError(null);
    if (!parsed.success) return;
    inviteMutation.mutate(parsed.data);
  }

  const users: OrgUser[] = usersQuery.data ?? [];
  const loading = usersQuery.isLoading || rolesQuery.isLoading;
  const error = usersQuery.error || rolesQuery.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Invita miembros con roles de la organización (§33)."
        actions={
          canWrite ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(true)}
              aria-label="Invitar usuario"
            >
              <MailPlus className={buttonIconClassName} />
              <ButtonLabel>Invitar</ButtonLabel>
            </Button>
          ) : null
        }
      />

      {loading ? <LoadingState variant="table" label="Cargando usuarios…" /> : null}
      {!loading && error ? (
        <ErrorState message={error instanceof Error ? error.message : "Error al cargar usuarios"} />
      ) : null}

      {!loading && !error && users.length === 0 ? (
        <EmptyState
          title="Sin usuarios"
          description="Invita al primer colaborador de tu organización."
        />
      ) : null}

      {!loading && !error && users.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Email</TH>
              <TH>Roles</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD label="Nombre" className="font-medium">
                  {u.name}
                </TD>
                <TD label="Email">{u.email}</TD>
                <TD label="Roles">
                  <div className="flex flex-wrap gap-1 md:justify-start max-md:justify-end">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="outline">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD label="Estado">{statusBadge(u.status)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : null}

      <Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Invitar usuario" size="md">
        <DialogHeader title="Invitar usuario" onClose={() => setOpen(false)} />
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            {touched && fieldErrors.email ? <FieldError message={fieldErrors.email} /> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nombre</Label>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
            {touched && fieldErrors.name ? <FieldError message={fieldErrors.name} /> : null}
          </div>
          <div className="space-y-2">
            <MultiSelect
              label="Roles"
              options={assignableRoles.map((role) => ({ value: role.code, text: role.name }))}
              value={roles}
              onChange={setRoles}
            />
            {touched && fieldErrors.roles ? <FieldError message={fieldErrors.roles} /> : null}
          </div>
          {formError ? <FieldError message={formError} /> : null}
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Se enviará un email con enlace para crear la contraseña (válido temporalmente).
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            <ButtonLabel>Cancelar</ButtonLabel>
          </Button>
          <Button type="button" onClick={submit} disabled={inviteMutation.isPending}>
            <ButtonLabel>{inviteMutation.isPending ? "Enviando…" : "Enviar invite"}</ButtonLabel>
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
