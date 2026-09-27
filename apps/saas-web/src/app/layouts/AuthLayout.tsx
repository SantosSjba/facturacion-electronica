import { Link, Outlet } from "react-router-dom";
import { Button, Input, Label } from "@factosys/ui";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Factosys
        </p>
        <h1 className="mt-1 text-xl font-semibold text-gray-800 dark:text-white/90">
          Acceso
        </h1>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <Outlet />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        <Link className="text-brand-600 hover:underline" to="/app">
          Volver al panel
        </Link>
      </p>
    </div>
  );
}

/** Login stub demonstrating @factosys/ui Button + Input. */
export function LoginPage() {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          placeholder="tu@empresa.com"
          autoComplete="username"
        />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full">
        Entrar (placeholder)
      </Button>
      <p className="text-xs text-gray-500">
        Sin wire API — solo esqueleto S12.
      </p>
    </form>
  );
}
