import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { LoadingState } from "@/shared/ui/LoadingState";

/**
 * S15-ONB: invite emails point to saas-web.
 * Keep this console route as a redirect for old links.
 */
export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = (searchParams.get("token") ?? "").trim();
    const base = (
      (import.meta.env.VITE_SAAS_WEB_PUBLIC_URL as string | undefined) ??
      "http://localhost:5174"
    ).replace(/\/$/, "");
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    window.location.replace(`${base}/auth/accept-invite${qs}`);
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label="Redirigiendo al panel…" />
    </div>
  );
}
