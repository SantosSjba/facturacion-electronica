import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AdminSidebar, type AdminNavGroup } from "@factosys/ui";
import { useSession } from "@/shared/auth/session-context";
import { filterNavByPermissions } from "@/shared/auth/permissions";
import { ORG_NAV_ITEMS, PLATFORM_NAV_ITEMS } from "../nav-config";
import { PortalLink, PortalLogo } from "./branding";

export function AppSidebar() {
  const { user, isPlatform } = useSession();
  const { pathname } = useLocation();
  const groups = useMemo<AdminNavGroup[]>(
    () => [
      {
        id: "main",
        label: isPlatform ? "Administración" : "Mi cuenta",
        items: filterNavByPermissions(
          isPlatform ? PLATFORM_NAV_ITEMS : ORG_NAV_ITEMS,
          user?.perms ?? [],
        ).map((item) => ({
          id: item.id,
          label: item.label,
          href: item.to,
          exact: item.to === "/app" || item.to === "/platform",
          icon: <item.icon className="size-6" />,
        })),
      },
    ],
    [user?.perms, isPlatform],
  );
  return (
    <AdminSidebar
      groups={groups}
      pathname={pathname}
      homeHref={isPlatform ? "/platform" : "/app"}
      logo={<PortalLogo />}
      compactLogo={<PortalLogo compact />}
      LinkComponent={PortalLink}
      label={isPlatform ? "Navegación administrativa" : "Navegación del cliente"}
    />
  );
}
