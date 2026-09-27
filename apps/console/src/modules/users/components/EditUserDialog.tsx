import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, X } from "lucide-react";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { toast } from "@/shared/ui/toaster";
import { cn } from "@/shared/ui/utils";

import { patchOrgUser, putOrgUserRoles } from "../api";
import type { OrgRole, OrgUser, UserStatus } from "../types";
import { RolesMultiSelect } from "./RolesMultiSelect";

const editUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresa el nombre completo")
    .max(120, "Máximo 120 caracteres"),
  roles: z.array(z.string()).min(1, "Selecciona al menos un rol"),
});

type EditUserField = keyof z.infer<typeof editUserSchema>;

export function EditUserDialog({
  open,
  onClose,
  user,
  roles,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  user: OrgUser | null;
  roles: OrgRole[];
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const hydratedUserIdRef = useRef<string | null>(null);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<UserStatus>("active");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<EditUserField, string>>
  >({});
  const [touched, setTouched] = useState<
    Partial<Record<EditUserField, boolean>>
  >({});

  useEffect(() => {
    if (!open || !user) {
      hydratedUserIdRef.current = null;
      return;
    }
    if (hydratedUserIdRef.current === user.id) return;
    setName(user.name);
    setStatus((user.status as UserStatus) || "active");
    setSelectedRoles([...user.roles]);
    setError(null);
    setFieldErrors({});
    setTouched({});
    hydratedUserIdRef.current = user.id;
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuario no seleccionado");
      await patchOrgUser(user.id, { name: name.trim(), status });
      return putOrgUserRoles(user.id, selectedRoles);
    },
    onSuccess: async (updated) => {
      await qc.invalidateQueries({ queryKey: ["org-users"] });
      toast.success("Usuario actualizado", {
        description: updated.email,
      });
      onClose();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al actualizar";
      setError(message);
      toast.error(message);
    },
  });

  function validateField(
    field: EditUserField,
    values: { name: string; roles: string[] },
  ) {
    const result = editUserSchema.shape[field].safeParse(values[field]);
    const message = result.success
      ? undefined
      : result.error.issues[0]?.message;
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
    return Boolean(result.success);
  }

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !user) return;
    setError(null);
    setTouched({ name: true, roles: true });
    const result = editUserSchema.safeParse({
      name,
      roles: selectedRoles,
    });
    if (!result.success) {
      const nextErrors: Partial<Record<EditUserField, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as EditUserField;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      const first = result.error.issues[0]?.message ?? "Revisa el formulario";
      toast.error("Datos inválidos", { description: first });
      return;
    }
    setFieldErrors({});
    mutation.mutate();
  }

  return (
    <Dialog
      open={open && Boolean(user)}
      onClose={handleClose}
      ariaLabel="Editar usuario"
      size="xl"
      closeOnBackdrop={!mutation.isPending}
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <DialogHeader
          title="Editar usuario"
          description={
            canWrite
              ? "Actualiza nombre, estado y roles en un solo paso."
              : "Vista de solo lectura."
          }
          onClose={handleClose}
        />
        <DialogBody className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={user?.email ?? ""}
                  disabled
                  readOnly
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={name}
                  disabled={!canWrite}
                  aria-invalid={Boolean(fieldErrors.name)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setName(next);
                    if (touched.name || fieldErrors.name) {
                      validateField("name", { name: next, roles: selectedRoles });
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                    validateField("name", { name, roles: selectedRoles });
                  }}
                />
                <FieldError message={fieldErrors.name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Estado</Label>
                <Select
                  id="edit-status"
                  value={status}
                  disabled={!canWrite}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                >
                  <option value="active">Activo</option>
                  <option value="disabled">Deshabilitado</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <RolesMultiSelect
                roles={roles}
                value={selectedRoles}
                disabled={!canWrite}
                onChange={(next) => {
                  setSelectedRoles(next);
                  setTouched((prev) => ({ ...prev, roles: true }));
                  validateField("roles", { name, roles: next });
                }}
              />
              <FieldError message={fieldErrors.roles} />
            </div>
          </div>
          {error ? <ErrorState title="Error" message={error} /> : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="icon-label-sm"
            aria-label="Cancelar"
            disabled={mutation.isPending}
            onClick={handleClose}
          >
            <X className={buttonIconClassName} />
            <ButtonLabel>{canWrite ? "Cancelar" : "Cerrar"}</ButtonLabel>
          </Button>
          {canWrite ? (
            <Button
              type="submit"
              size="icon-label-sm"
              aria-label="Guardar"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
              ) : (
                <Save className={buttonIconClassName} />
              )}
              <ButtonLabel>
                {mutation.isPending ? "Guardando…" : "Guardar"}
              </ButtonLabel>
            </Button>
          ) : null}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
