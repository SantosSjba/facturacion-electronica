import { Spinner } from "@factosys/ui";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Eye, EyeOff, LogIn, Moon, ShieldCheck, Sun } from "lucide-react";

import { ApiError, getErrorMessage } from "@/shared/api/errors";
import { getAccessTokenMemory, type LoginOrganizationOption } from "@/shared/api/http-client";
import { decodeAccessToken } from "@/shared/auth/jwt";
import { useSession } from "@/shared/auth/session-context";
import { resolveHomePath } from "@/app/nav-config";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Input,
  Label,
  FieldError,
  cn,
  toast,
} from "@factosys/ui";

import { useTheme } from "@/shared/ui/theme-context";

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state ?? {}) as {
    email?: string;
    organizationSlug?: string;
  };
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState(prefill.email ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [orgChoices, setOrgChoices] = useState<LoginOrganizationOption[] | null>(null);
  const [selectingOrgId, setSelectingOrgId] = useState<string | null>(null);
  const loginToast = useRef<string | number | undefined>(undefined);

  function homeAfterLogin(): string {
    const claims = decodeAccessToken(getAccessTokenMemory() ?? "");
    if (!claims) return "/app";
    const ctx =
      claims.ctx === "platform" || claims.ctx === "org"
        ? claims.ctx
        : claims.roles.some((r) => r.startsWith("platform_"))
          ? "platform"
          : "org";
    return resolveHomePath(claims.perms, ctx);
  }

  async function authenticate(org?: { organizationId?: string; organizationSlug?: string }) {
    if (loginToast.current !== undefined) toast.dismiss(loginToast.current);
    const toastId = toast.loading("Iniciando sesión…");
    loginToast.current = toastId;
    setSubmitting(true);
    try {
      const outcome = await login({
        email,
        password,
        organizationId: org?.organizationId,
        organizationSlug: org?.organizationSlug ?? prefill.organizationSlug ?? undefined,
      });
      if (outcome.status === "org_selection_required") {
        toast.dismiss(toastId);
        setOrgChoices(outcome.organizations);
        return;
      }
      setOrgChoices(null);
      toast.success("Sesión iniciada", { id: toastId });
      navigate(homeAfterLogin(), { replace: true });
    } catch (err) {
      const message = err instanceof ApiError && err.status === 401
        ? "El correo o la contraseña son incorrectos."
        : getErrorMessage(err, "No se pudo iniciar sesión. Inténtalo de nuevo.");
      toast.error("No se pudo iniciar sesión", {
        id: toastId,
        description: message,
        duration: 6000,
      });
    } finally {
      setSubmitting(false);
      setSelectingOrgId(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Ingresa un correo válido";
    }
    if (password.length < 8) {
      nextErrors.password = "La contraseña debe tener al menos 8 caracteres";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await authenticate();
  }

  async function onSelectOrg(org: LoginOrganizationOption) {
    setSelectingOrgId(org.id);
    await authenticate({
      organizationId: org.id,
      organizationSlug: org.slug ?? undefined,
    });
  }

  function backToCredentials() {
    setOrgChoices(null);
    setSelectingOrgId(null);
  }

  const pickingOrg = Boolean(orgChoices && orgChoices.length > 0);

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
                <span className="text-xl font-bold text-gray-900 dark:text-white">FACTOSYS</span>
              </div>
              {pickingOrg ? (
                <>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={backToCredentials}
                    className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
                  >
                    <ArrowLeft className="size-4" />
                    Volver
                  </Button>
                  <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
                    Elige una organización
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tu cuenta tiene acceso a varias organizaciones. Selecciona a cuál entrar.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
                    Iniciar sesión
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ingresa tus credenciales para acceder al panel plataforma.
                  </p>
                </>
              )}
            </div>

            {pickingOrg ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {orgChoices?.map((org) => {
                    const busy = selectingOrgId === org.id;
                    const initials = org.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("");
                    return (
                      <Button
                        variant="ghost"
                        key={org.id}
                        type="button"
                        data-testid={`login-org-${org.slug ?? org.id}`}
                        disabled={submitting}
                        onClick={() => void onSelectOrg(org)}
                        className={cn(
                          "flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors",
                          "hover:border-brand-300 hover:bg-brand-50/40",
                          "dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10",
                          "disabled:cursor-not-allowed disabled:opacity-60",
                          busy && "border-brand-400 ring-2 ring-brand-500/20",
                        )}
                      >
                        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                          {busy ? (
                            <Spinner className="size-5" />
                          ) : initials ? (
                            initials
                          ) : (
                            <Building2 className="size-5" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                            {org.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                            {org.slug ?? org.id.slice(0, 8)}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form className="space-y-6" noValidate onSubmit={(e) => void onSubmit(e)}>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-error-500">*</span>
                  </Label>
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
                  <Label htmlFor="password">
                    Contraseña <span className="text-error-500">*</span>
                  </Label>
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
                    <Button
                      variant="ghost"
                      type="button"
                      className="absolute end-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
                    </Button>
                  </div>
                  <FieldError message={fieldErrors.password} />
                </div>


                <Button
                  type="submit"
                  size="icon-label"
                  className="w-full"
                  aria-label="Entrar"
                  disabled={submitting}
                  data-testid="login-submit"
                >
                  {submitting ? (
                    <Spinner className={buttonIconClassName} />
                  ) : (
                    <LogIn className={buttonIconClassName} />
                  )}
                  <ButtonLabel>{submitting ? "Entrando…" : "Entrar"}</ButtonLabel>
                </Button>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  <span className="cursor-not-allowed opacity-50" title="Disponible en v2">
                    Olvidé contraseña
                  </span>
                </p>
              </form>
            )}
            <p className="mt-6 text-center text-theme-xs text-gray-400">
              Acceso seguro · API de facturación electrónica para Perú
            </p>
          </div>
        </div>

        <div className="relative hidden min-h-screen w-1/2 items-center justify-center overflow-hidden bg-brand-950 lg:flex dark:bg-white/5">
          <div className="absolute -start-28 -top-28 size-96 rounded-full border border-white/10" />
          <div className="absolute -bottom-36 -end-24 size-[32rem] rounded-full border border-white/10" />
          <div className="relative z-1 flex max-w-md flex-col items-center px-8 text-center">
            <span className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-brand-600 shadow-theme-xl">
              FS
            </span>
            <h2 className="text-title-sm font-semibold text-white">FACTOSYS</h2>
            <p className="mt-3 text-gray-400">
              Gestión de solicitudes, organizaciones, planes y KPIs de plataforma Factosys.
            </p>
            <div className="mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              <ShieldCheck className="size-4 text-success-400" /> Sesión y permisos protegidos
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          type="button"
          onClick={toggleTheme}
          className="fixed end-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-theme-lg dark:bg-white dark:text-gray-900"
          aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
        >
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
      </div>
    </div>
  );
}
