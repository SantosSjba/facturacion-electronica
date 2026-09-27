import { NavLink, Outlet } from "react-router-dom";
import { AppShell, Button } from "@factosys/ui";

export function PanelShell({
  area,
  title,
}: {
  area: "platform" | "app";
  title: string;
}) {
  const links =
    area === "platform"
      ? [
          { to: "/platform", label: "Inicio" },
          { to: "/app", label: "Ir a App" },
          { to: "/auth/login", label: "Auth" },
        ]
      : [
          { to: "/app", label: "Inicio" },
          { to: "/platform", label: "Ir a Platform" },
          { to: "/auth/login", label: "Auth" },
        ];

  return (
    <AppShell
      sidebar={
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Factosys
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {title}
            </p>
          </div>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === `/${area}`}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
                  ].join(" ")
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      }
      header={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            SaaS shell ({area})
          </span>
          <Button variant="outline" size="sm" type="button" disabled>
            Cuenta
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
