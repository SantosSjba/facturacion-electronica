import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";

const defaultOrgSlug =
  (import.meta.env.VITE_DEFAULT_ORG_SLUG as string | undefined) || "demo";

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState(defaultOrgSlug);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div className="mb-8 space-y-1 text-center">
          <p className="text-2xl font-semibold tracking-wide text-[var(--foreground)]">
            FACTOSYS
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Consola de operaciones
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="organization_slug">Organización</Label>
            <Input
              id="organization_slug"
              name="organization_slug"
              autoComplete="organization"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? <ErrorState title="Error de acceso" message={error} /> : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </Button>

          <p className="text-center text-sm text-[var(--muted-foreground)]">
            <span
              className="cursor-not-allowed opacity-50"
              title="Disponible en v2"
            >
              Olvidé contraseña
            </span>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          Demo:{" "}
          <Link className="underline" to="/login">
            org demo / owner@demo.local
          </Link>
        </p>
      </div>
    </div>
  );
}
