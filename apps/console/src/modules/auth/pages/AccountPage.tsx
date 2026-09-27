import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, KeyRound, Loader2, Shield, UserRound } from "lucide-react";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";

import { changePassword, fetchMe } from "../api";

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

export function AccountPage() {
  const meQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
  });

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
    : Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ) as Partial<
        Record<"current_password" | "new_password" | "confirm", string>
      >;

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

  if (meQuery.isLoading) {
    return <LoadingState label="Cargando cuenta…" />;
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <ErrorState
        message={
          meQuery.error instanceof Error
            ? meQuery.error.message
            : "No se pudo cargar el perfil"
        }
        onRetry={() => void meQuery.refetch()}
      />
    );
  }

  const me = meQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi cuenta"
        description="Perfil de sesión y cambio de contraseña."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-3.5 text-gray-400" aria-hidden />
            Perfil
          </CardTitle>
          <dl className="space-y-4">
            <div>
              <MutedText as="dt" className="text-theme-xs">
                Nombre
              </MutedText>
              <dd className="mt-0.5 text-sm font-medium text-gray-800 dark:text-white/90">
                {me.name || "—"}
              </dd>
            </div>
            <div>
              <MutedText as="dt" className="text-theme-xs">
                Email
              </MutedText>
              <dd className="mt-0.5 font-mono text-sm text-gray-800 dark:text-white/90">
                {me.email}
              </dd>
            </div>
            <div>
              <MutedText as="dt" className="mb-1.5 flex items-center gap-1 text-theme-xs">
                <Building2 className="size-3" aria-hidden />
                Organización
              </MutedText>
              <dd className="text-sm text-gray-800 dark:text-white/90">
                {me.organization_name}
                {me.organization_slug ? (
                  <MutedText as="span" className="ms-2 font-mono text-theme-xs">
                    {me.organization_slug}
                  </MutedText>
                ) : null}
              </dd>
            </div>
            <div>
              <MutedText as="dt" className="mb-1.5 flex items-center gap-1 text-theme-xs">
                <Shield className="size-3" aria-hidden />
                Roles
              </MutedText>
              <dd className="flex flex-wrap gap-1">
                {me.roles.length === 0 ? (
                  <MutedText>Sin roles</MutedText>
                ) : (
                  me.roles.map((r) => (
                    <Badge key={r} variant="outline">
                      {r}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-3.5 text-gray-400" aria-hidden />
            Cambiar contraseña
          </CardTitle>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              setSuccess(false);
              setFormError(null);
              if (!parsed.success) return;
              mutation.mutate({
                current_password: currentPassword,
                new_password: newPassword,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="account-current">Contraseña actual</Label>
              <Input
                id="account-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                aria-invalid={touched && Boolean(fieldErrors.current_password)}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              {touched ? (
                <FieldError message={fieldErrors.current_password} />
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-new">Nueva contraseña</Label>
              <Input
                id="account-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                aria-invalid={touched && Boolean(fieldErrors.new_password)}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {touched ? (
                <FieldError message={fieldErrors.new_password} />
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-confirm">Confirmar nueva</Label>
              <Input
                id="account-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                aria-invalid={touched && Boolean(fieldErrors.confirm)}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {touched ? <FieldError message={fieldErrors.confirm} /> : null}
            </div>
            {formError ? (
              <p className="text-sm text-error-600 dark:text-error-500">
                {formError}
              </p>
            ) : null}
            {success ? (
              <p className="text-sm text-success-600 dark:text-success-500">
                Contraseña actualizada.
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="icon-label"
                disabled={mutation.isPending}
                aria-label="Guardar contraseña"
              >
                {mutation.isPending ? (
                  <Loader2 className={`${buttonIconClassName} animate-spin`} />
                ) : (
                  <KeyRound className={buttonIconClassName} />
                )}
                <ButtonLabel>
                  {mutation.isPending ? "Guardando…" : "Guardar"}
                </ButtonLabel>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
