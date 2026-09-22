import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Moon, ShieldCheck, Sun } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { useTheme } from "@/shared/ui/theme-context";

const defaultOrgSlug =
  (import.meta.env.VITE_DEFAULT_ORG_SLUG as string | undefined) || "demo";

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState(defaultOrgSlug);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ organization?: string; email?: string; password?: string }>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nextErrors: typeof fieldErrors = {};
    if (!organizationSlug.trim()) nextErrors.organization = "Ingresa la organización";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Ingresa un correo válido";
    if (password.length < 8) nextErrors.password = "La contraseña debe tener al menos 8 caracteres";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await login({ email, password, organizationSlug });
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Credenciales inválidas");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo iniciar sesión");
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
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">FS</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">FACTOSYS</span>
              </div>
              <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">Iniciar sesión</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ingresa tus credenciales para acceder a la consola.</p>
            </div>

            <form className="space-y-6" noValidate onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="organization_slug">Organización <span className="text-error-500">*</span></Label>
            <Input
              id="organization_slug"
              name="organization_slug"
              data-testid="login-org"
              autoComplete="organization"
              value={organizationSlug}
              aria-invalid={Boolean(fieldErrors.organization)}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              required
            />
            <FieldError message={fieldErrors.organization} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-error-500">*</span></Label>
            <Input
              id="email"
              name="email"
              type="email"
              data-testid="login-email"
              autoComplete="username"
              value={email}
              placeholder="usuario@empresa.com"
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <FieldError message={fieldErrors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña <span className="text-error-500">*</span></Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                data-testid="login-password"
                autoComplete="current-password"
                minLength={8}
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pe-12"
              />
              <button type="button" className="absolute end-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 dark:text-gray-400" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {showPassword ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </button>
            </div>
            <FieldError message={fieldErrors.password} />
          </div>

          {error ? <ErrorState title="Error de acceso" message={error} /> : null}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            data-testid="login-submit"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </Button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            <span
              className="cursor-not-allowed opacity-50"
              title="Disponible en v2"
            >
              Olvidé contraseña
            </span>
          </p>
            </form>
            <p className="mt-6 text-center text-theme-xs text-gray-400">Acceso seguro · API de facturación electrónica para Perú</p>
          </div>
        </div>

        <div className="relative hidden min-h-screen w-1/2 items-center justify-center overflow-hidden bg-brand-950 lg:flex dark:bg-white/5">
          <div className="absolute -start-28 -top-28 size-96 rounded-full border border-white/10" />
          <div className="absolute -bottom-36 -end-24 size-[32rem] rounded-full border border-white/10" />
          <div className="relative z-1 flex max-w-md flex-col items-center px-8 text-center">
            <span className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-brand-600 shadow-theme-xl">FS</span>
            <h2 className="text-title-sm font-semibold text-white">FACTOSYS</h2>
            <p className="mt-3 text-gray-400">Gestión centralizada de comprobantes electrónicos, empresas, usuarios y operaciones SUNAT.</p>
            <div className="mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300"><ShieldCheck className="size-4 text-success-400" /> Sesión y permisos protegidos</div>
          </div>
        </div>

        <button type="button" onClick={toggleTheme} className="fixed end-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-theme-lg dark:bg-white dark:text-gray-900" aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}>
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
      </div>
    </div>
  );
}
