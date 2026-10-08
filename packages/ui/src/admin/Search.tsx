import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./icons";
import type { AdminLinkComponent, AdminNavItem } from "./types";
import { useAdminDropdown } from "./dropdown";

export function AdminSearch({
  items,
  LinkComponent,
  placeholder,
  emptyLabel,
}: {
  items: AdminNavItem[];
  LinkComponent: AdminLinkComponent;
  placeholder: string;
  emptyLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { open, setOpen, ref } = useAdminDropdown();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [setOpen]);
  const results = items.filter((item) =>
    item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div ref={ref} className="relative">
      <span className="pointer-events-none absolute inset-s-4 top-1/2 -translate-y-1/2">
        <SearchIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
      </span>
      <input
        ref={inputRef}
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 ps-12 pe-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden xl:w-107.5 dark:border-gray-800 dark:bg-white/3 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
      />
      <button
        type="button"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        aria-label={placeholder}
        className="absolute inset-e-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-1.75 py-1 text-xs text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400"
      >
        <span>⌘</span>
        <span>K</span>
      </button>
      {open && (
        <div className="absolute top-full z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
          {results.length ? (
            results.map((item) => (
              <LinkComponent
                key={item.id}
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="flex items-center gap-3 rounded-lg p-3 text-theme-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                {item.icon}
                {item.label}
              </LinkComponent>
            ))
          ) : (
            <p className="p-3 text-theme-sm text-gray-500">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
