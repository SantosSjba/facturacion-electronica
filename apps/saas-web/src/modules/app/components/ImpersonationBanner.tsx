import { useNavigate } from "react-router-dom";

import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";

/** Red blocking-style banner while a platform admin is impersonating a tenant. */
export function ImpersonationBanner() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const imp = user?.impersonation;
  if (!imp) return null;

  const endsAt =
    imp.expiresAt != null
      ? new Date(imp.expiresAt * 1000).toLocaleTimeString()
      : null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 border-b border-error-600 bg-error-600 px-4 py-2.5 text-sm text-white shadow-md"
    >
      <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-3">
        <p className="min-w-0">
          <strong className="font-semibold">Modo suplantar</strong>
          {" — "}
          {imp.reason}
          {endsAt ? ` · expira ${endsAt}` : null}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-white/40 bg-transparent text-white hover:bg-white/10"
          onClick={() => {
            void logout().then(() => {
              navigate("/auth/login", { replace: true });
            });
          }}
        >
          Salir de suplantar
        </Button>
      </div>
    </div>
  );
}
