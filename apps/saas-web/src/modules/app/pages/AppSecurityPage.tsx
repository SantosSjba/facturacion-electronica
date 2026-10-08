import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { z } from "zod";

import { changePassword } from "@/modules/app/api/auth";
import { ApiError } from "@/shared/api/errors";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Card,
  CardTitle,
  Input,
  Label,
  FieldError,
  PageHeader,
} from "@factosys/ui";

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Ingresa tu contraseña actual"),
    new_password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .superRefine((data, ctx) => {
    if (data.new_password !== data.confirm) {
      ctx.addIssue({
        code: "custom",
        path: ["confirm"],
        message: "Las contraseñas no coinciden",
      });
    }
  });

export function AppSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const parsed = passwordSchema.safeParse({
    current_password: currentPassword,
    new_password: newPassword,
    confirm,
  });
  const fieldErrors = parsed.success
    ? {}
    : (Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ) as Partial<Record<"current_password" | "new_password" | "confirm", string>>);

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setTouched(false);
      setFormError(null);
      setSuccess(true);
    },
    onError: (err) => {
      setSuccess(false);
      if (err instanceof ApiError) setFormError(err.message);
      else if (err instanceof Error) setFormError(err.message);
      else setFormError("No se pudo cambiar la contraseña");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSuccess(false);
    setFormError(null);
    if (!parsed.success) return;
    mutation.mutate({
      current_password: parsed.data.current_password,
      new_password: parsed.data.new_password,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguridad"
        description="Cambia tu contraseña. Se verifica la actual con Argon2."
      />

      <Card className="max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>Cambiar contraseña</CardTitle>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            {touched && fieldErrors.current_password ? (
              <FieldError message={fieldErrors.current_password} />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {touched && fieldErrors.new_password ? (
              <FieldError message={fieldErrors.new_password} />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {touched && fieldErrors.confirm ? <FieldError message={fieldErrors.confirm} /> : null}
          </div>
          {formError ? <FieldError message={formError} /> : null}
          {success ? (
            <p className="text-sm text-success-600 dark:text-success-500">
              Contraseña actualizada correctamente.
            </p>
          ) : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className={`${buttonIconClassName} animate-spin`} />
            ) : (
              <KeyRound className={buttonIconClassName} />
            )}
            <ButtonLabel>{mutation.isPending ? "Guardando…" : "Guardar"}</ButtonLabel>
          </Button>
        </form>
      </Card>
    </div>
  );
}
