import { useQuery } from "@tanstack/react-query";
import { KeyRound, Layers, Users } from "lucide-react";
import {
  AdminHeader,
  AdminNotificationDropdown,
  AdminSearch,
  AdminThemeToggle,
  AdminUserDropdown,
} from "@factosys/ui";
import { fetchNotifications } from "@/modules/app/api/notifications";
import { useSession } from "@/shared/auth/session-context";
import { filterNavByPermissions } from "@/shared/auth/permissions";
import { useTheme } from "@/shared/ui/theme-context";
import { ORG_NAV_ITEMS, PLATFORM_NAV_ITEMS } from "../nav-config";
import { PortalLink, PortalLogo } from "./branding";

export function AppHeader() {
  const { user, logout, isPlatform } = useSession();
  const { theme, toggleTheme } = useTheme();
  const query = useQuery({
    queryKey: ["org-notifications", user?.organizationId],
    queryFn: fetchNotifications,
    enabled: Boolean(user) && !isPlatform,
    refetchInterval: 60_000,
  });
  const navItems = filterNavByPermissions(
    isPlatform ? PLATFORM_NAV_ITEMS : ORG_NAV_ITEMS,
    user?.perms ?? [],
  );
  const items = navItems.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.to,
    icon: <item.icon className="size-5" />,
  }));
  return (
    <AdminHeader
      homeHref={isPlatform ? "/platform" : "/app"}
      logo={<PortalLogo />}
      LinkComponent={PortalLink}
      labels={{ toggleSidebar: "Alternar menú lateral", actions: "Abrir acciones de cuenta" }}
      search={
        <AdminSearch
          items={items}
          LinkComponent={PortalLink}
          placeholder="Buscar una sección…"
          emptyLabel="No hay secciones disponibles."
        />
      }
      actions={
        <>
          <div className="flex items-center gap-2 2xsm:gap-3">
            <AdminThemeToggle
              theme={theme}
              onToggle={toggleTheme}
              label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
            />
            {!isPlatform && (
              <AdminNotificationDropdown
                LinkComponent={PortalLink}
                href="/app/notifications"
                unreadCount={query.data?.unread_count ?? 0}
                loading={query.isLoading}
                error={Boolean(query.error)}
                items={(query.data?.items ?? [])
                  .slice(0, 8)
                  .map((item) => ({
                    id: item.id,
                    title: item.title ?? "Notificación",
                    body: item.body ?? undefined,
                    time: new Date(item.created_at).toLocaleString("es-PE"),
                    unread: !item.read_at,
                  }))}
                labels={{
                  title: "Notificaciones",
                  all: "Ver todas las notificaciones",
                  empty: "No tienes notificaciones.",
                  loading: "Cargando…",
                  error: "No se pudieron cargar las notificaciones.",
                  close: "Cerrar notificaciones",
                }}
              />
            )}
          </div>
          <AdminUserDropdown
            name={isPlatform ? "Administrador" : "Mi cuenta"}
            email={user?.email ?? ""}
            onLogout={() => void logout()}
            LinkComponent={PortalLink}
            labels={{ menu: "Abrir menú de usuario", logout: "Cerrar sesión" }}
            items={
              isPlatform
                ? [
                    {
                      id: "plans",
                      label: "Planes",
                      href: "/platform/plans",
                      icon: <Layers className="size-5" />,
                    },
                  ]
                : [
                    {
                      id: "security",
                      label: "Seguridad",
                      href: "/app/security",
                      icon: <KeyRound className="size-5" />,
                    },
                    ...(user?.perms.includes("users:read")
                      ? [
                          {
                            id: "users",
                            label: "Usuarios",
                            href: "/app/users",
                            icon: <Users className="size-5" />,
                          },
                        ]
                      : []),
                  ]
            }
          />
        </>
      }
    />
  );
}
