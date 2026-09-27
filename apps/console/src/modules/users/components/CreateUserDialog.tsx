import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, X } from "lucide-react";
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

import { createOrgUser } from "../api";
import type { OrgRole, UserStatus } from "../types";
import { RolesMultiSelect } from "./RolesMultiSelect";

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Ingresa un correo electrónico válido"),
  name: z
    .string()
    .trim()
    .min(2, "Ingresa el nombre completo")
    .max(120, "Máximo 120 caracteres"),
  password: z
    .string()
    .min(8, "Usa al menos 8 caracteres")
    .regex(/[A-Za-z]/, "Incluye al menos una letra")
    .regex(/\d/, "Incluye al menos un número"),
  roles: z.array(z.string()).min(1, "Selecciona al menos un rol"),
});

type CreateUserField = keyof z.infer<typeof createUserSchema>;

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  };
}

export function CreateUserDialog({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: OrgRole[];
}) {
  const qc = useQueryClient();
  const hydratedOpenRef = useRef(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<UserStatus>("active");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<CreateUserField, string>>
  >({});
  const [touched, setTouched] = useState<
    Partial<Record<CreateUserField, boolean>>
  >({});

  function resetForm() {
    setEmail("");
    setName("");
    setPassword("");
    setStatus("active");
    setSelectedRoles([]);
    setError(null);
    setFieldErrors({});
    setTouched({});
  }

  useEffect(() => {
    if (!open) {
      hydratedOpenRef.current = false;
      return;
    }
    if (!hydratedOpenRef.current) {
      resetForm();
      hydratedOpenRef.current = true;
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: createOrgUser,
    onSuccess: async (user) => {
      await qc.invalidateQueries({ queryKey: ["org-users"] });
      toast.success("Usuario creado", { description: user.email });
      resetForm();
      onClose();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo crear el usuario";
      setError(message);
      toast.error(message);
    },
  });

  function validateField(
    field: CreateUserField,
    values: {
      email: string;
      name: string;
      password: string;
      roles: string[];
    },
  ) {
    const result = createUserSchema.shape[field].safeParse(values[field]);
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
    setError(null);
    setTouched({ email: true, name: true, password: true, roles: true });
    const result = createUserSchema.safeParse({
      email,
      name,
      password,
      roles: selectedRoles,
    });
    if (!result.success) {
      const nextErrors: Partial<Record<CreateUserField, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as CreateUserField;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      const first = result.error.issues[0]?.message ?? "Revisa el formulario";
      toast.error("Datos inválidos", { description: first });
      return;
    }
    setFieldErrors({});
    mutation.mutate({
      email: result.data.email,
      name: result.data.name,
      password: result.data.password,
      roles: result.data.roles,
      status,
    });
  }

  const checks = passwordChecks(password);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      ariaLabel="Invitar o crear usuario"
      size="xl"
      closeOnBackdrop={!mutation.isPending}
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <DialogHeader
          title="Invitar / crear usuario"
          description="Configura sus datos de acceso y permisos iniciales."
          onClose={handleClose}
        />
        <DialogBody className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "create-email-error" : undefined
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    setEmail(next);
                    if (touched.email || fieldErrors.email) {
                      validateField("email", {
                        email: next,
                        name,
                        password,
                        roles: selectedRoles,
                      });
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, email: true }));
                    validateField("email", {
                      email,
                      name,
                      password,
                      roles: selectedRoles,
                    });
                  }}
                />
                <FieldError id="create-email-error" message={fieldErrors.email} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-name">Nombre</Label>
                <Input
                  id="create-name"
                  autoComplete="off"
                  value={name}
                  aria-invalid={Boolean(fieldErrors.name)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setName(next);
                    if (touched.name || fieldErrors.name) {
                      validateField("name", {
                        email,
                        name: next,
                        password,
                        roles: selectedRoles,
                      });
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                    validateField("name", {
                      email,
                      name,
                      password,
                      roles: selectedRoles,
                    });
                  }}
                />
                <FieldError message={fieldErrors.name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-password">Contraseña temporal</Label>
                <Input
                  id="create-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={Boolean(fieldErrors.password)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPassword(next);
                    if (touched.password || fieldErrors.password) {
                      validateField("password", {
                        email,
                        name,
                        password: next,
                        roles: selectedRoles,
                      });
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, password: true }));
                    validateField("password", {
                      email,
                      name,
                      password,
                      roles: selectedRoles,
                    });
                  }}
                />
                <ul className="mt-2 space-y-1">
                  <PasswordHint ok={checks.length} label="Al menos 8 caracteres" />
                  <PasswordHint ok={checks.letter} label="Al menos una letra" />
                  <PasswordHint ok={checks.number} label="Al menos un número" />
                </ul>
                <FieldError message={fieldErrors.password} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-status">Estado</Label>
                <Select
                  id="create-status"
                  value={status}
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
                onChange={(next) => {
                  setSelectedRoles(next);
                  setTouched((prev) => ({ ...prev, roles: true }));
                  validateField("roles", {
                    email,
                    name,
                    password,
                    roles: next,
                  });
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
            <ButtonLabel>Cancelar</ButtonLabel>
          </Button>
          <Button
            type="submit"
            size="icon-label-sm"
            aria-label="Crear"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
            ) : (
              <Plus className={buttonIconClassName} />
            )}
            <ButtonLabel>
              {mutation.isPending ? "Creando…" : "Crear"}
            </ButtonLabel>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function PasswordHint({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 text-theme-xs",
        ok
          ? "text-success-600 dark:text-success-500"
          : "text-gray-500 dark:text-gray-400",
      )}
    >
      <Check className="size-3.5 shrink-0" aria-hidden />
      {label}
    </li>
  );
}
