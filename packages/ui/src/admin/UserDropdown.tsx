import { ChevronDownIcon, LogoutIcon } from "./icons";
import { AdminDropdownPanel, useAdminDropdown } from "./dropdown";
import type { AdminLinkComponent, AdminNavItem } from "./types";

export interface AdminUserDropdownProps {
  name: string;
  email: string;
  avatarUrl?: string;
  items: AdminNavItem[];
  LinkComponent: AdminLinkComponent;
  onLogout: () => void;
  labels: { menu: string; logout: string };
}
export function AdminUserDropdown({
  name,
  email,
  avatarUrl,
  items,
  LinkComponent,
  onLogout,
  labels,
}: AdminUserDropdownProps) {
  const { open, setOpen, ref } = useAdminDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={labels.menu}
        aria-expanded={open}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
      >
        <span className="me-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : name.slice(0, 2).toUpperCase()}
        </span>
        <span className="me-1 block max-w-48 truncate text-theme-sm font-medium">{name}</span>
        <ChevronDownIcon
          className={`h-5 w-4.5 stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <AdminDropdownPanel>
          <div>
            <span className="block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
              {name}
            </span>
            <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
              {email}
            </span>
          </div>
          <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
            {items.map((item) => (
              <li key={item.id}>
                <LinkComponent
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  {item.icon}
                  {item.label}
                </LinkComponent>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="group mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogoutIcon className="size-6" />
            {labels.logout}
          </button>
        </AdminDropdownPanel>
      )}
    </div>
  );
}
