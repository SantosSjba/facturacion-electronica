import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { apiRequest } from "@/shared/api/http-client";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { FieldError } from "@/shared/ui/FieldError";
import { useTheme } from "@/shared/ui/theme-context";
import { cn } from "@/shared/ui/utils";

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => (searchParams.get("token") ?? "").trim(),
    [searchParams],
  );
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nextErrors: typeof fieldErrors = {};
    if (password.length < 8) {
      nextErrors.password = "Mínimo 8 caracteres";
    }
    if (password !== confirm) {
      nextErrors.confirm = "Las contraseñas no coinciden";
    }
    if (!token) {
      setError("Falta el token de invitación en la URL");
      return;
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        organization_slug: string | null;
        email: string;
      }>("/auth/accept-invite", {
        method: "POST",
        auth: false,
        body: { token, password },
      });
      setDoneEmail(res.email);
      setTimeout(
        () =>
          navigate("/auth/login", {
            replace: true,
            state: {
              email: res.email,
              organizationSlug: res.organization_slug,
            },
          }),
        1200,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "No se pudo activar la cuenta");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo activar la cuenta");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative z-1 min-h-screen bg-white p-6 sm:p-0 dark:bg-gray-900">
      <div className="relative flex min-h-screen w-full flex-col justify-center lg:flex-row">
        <div className="flex w-full flex-1 flex-col lg:w-1/2">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <div className="mb-5 sm:mb-8">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">
                  FS
                </span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  FACTOSYS
                </span>
              </div>
              <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
                Activar cuenta
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Crea tu contraseña de owner para acceder al panel.
              </p>
            </div>

            {doneEmail ? (
              <p className="text-sm text-success-600 dark:text-success-400">
                Cuenta activada ({doneEmail}). Redirigiendo al login…
              </p>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
                {error ? <FieldError message={error} /> : null}
                {!token ? (
                  <FieldError message="Enlace inválido: falta el parámetro token." />
                ) : null}

                <div>
                  <Label htmlFor="invite-password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="invite-password"
                      data-testid="invite-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-11"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-5" />
                      ) : (
                        <Eye className="size-5" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <FieldError message={fieldErrors.password} />
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="invite-confirm">Confirmar contraseña</Label>
                  <Input
                    id="invite-confirm"
                    data-testid="invite-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  {fieldErrors.confirm ? (
                    <FieldError message={fieldErrors.confirm} />
                  ) : null}
                </div>

                <Button
                  type="submit"
                  data-testid="invite-submit"
                  className="w-full"
                  disabled={submitting || !token}
                >
                  {submitting ? (
                    <Loader2
                      className={cn(buttonIconClassName, "animate-spin")}
                    />
                  ) : null}
                  <ButtonLabel>
                    {submitting ? "Activando…" : "Activar cuenta"}
                  </ButtonLabel>
                </Button>

                <p className="text-center text-sm text-gray-500">
                  ¿Ya tienes cuenta?{" "}
                  <Link
                    to="/auth/login"
                    className="text-brand-500 hover:underline"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="relative hidden w-full overflow-hidden bg-brand-950 lg:flex lg:w-1/2 lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-700/40 via-brand-950 to-brand-950" />
          <div className="relative z-10 max-w-md px-10 text-white">
            <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold backdrop-blur">
              FS
            </div>
            <h2 className="mb-3 text-3xl font-semibold tracking-tight">
              Bienvenido a Factosys
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              Activa tu cuenta owner y completa el onboarding para entrar al
              panel de tu organización.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="absolute right-6 bottom-6 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? (
              <Sun className="size-5" />
            ) : (
              <Moon className="size-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
