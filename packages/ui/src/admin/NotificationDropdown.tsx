import { BellIcon } from "./icons";
import { useAdminDropdown } from "./dropdown";
import type { AdminLinkComponent } from "./types";
import { ListSkeleton } from "../skeleton";

export interface AdminNotificationItem {
  id: string;
  title: string;
  body?: string;
  time: string;
  unread: boolean;
}
export interface AdminNotificationDropdownProps {
  items: AdminNotificationItem[];
  unreadCount: number;
  href: string;
  LinkComponent: AdminLinkComponent;
  loading?: boolean;
  error?: boolean;
  labels: {
    title: string;
    all: string;
    empty: string;
    loading: string;
    error: string;
    close: string;
  };
}
export function AdminNotificationDropdown({
  items,
  unreadCount,
  href,
  LinkComponent,
  loading,
  error,
  labels,
}: AdminNotificationDropdownProps) {
  const { open, setOpen, ref } = useAdminDropdown();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid="notif-bell"
        aria-label={labels.title}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:h-11 lg:w-11 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        {unreadCount > 0 && (
          <span className="absolute end-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
          </span>
        )}
        <BellIcon className="size-5" />
      </button>
      {open && (
        <div className="absolute -end-60 mt-4 flex h-120 w-90 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg sm:end-0 sm:w-96 dark:border-gray-800 dark:bg-gray-dark">
          <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h5 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {labels.title}
            </h5>
            <button
              type="button"
              aria-label={labels.close}
              onClick={() => setOpen(false)}
              className="text-gray-500"
            >
              ×
            </button>
          </div>
          <ul className="custom-scrollbar flex h-auto flex-col overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <LinkComponent
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                    <BellIcon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="mb-1.5 block text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="mb-1.5 block text-theme-sm text-gray-500 dark:text-gray-400">
                        {item.body}
                      </span>
                    )}
                    <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                      {item.time}
                    </span>
                  </span>
                  {item.unread && (
                    <span className="ms-auto mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  )}
                </LinkComponent>
              </li>
            ))}
          </ul>
          {loading && items.length === 0 && !error ? (
            <ListSkeleton label={labels.loading} rows={3} contained={false} />
          ) : null}
          {items.length === 0 && (!loading || error) && (
            <p className="p-4 text-theme-sm text-gray-500">{error ? labels.error : labels.empty}</p>
          )}
          <LinkComponent
            href={href}
            onClick={() => setOpen(false)}
            className="mt-auto flex justify-center rounded-lg border border-gray-300 bg-white p-3 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            {labels.all}
          </LinkComponent>
        </div>
      )}
    </div>
  );
}
