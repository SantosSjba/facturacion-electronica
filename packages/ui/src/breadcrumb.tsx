import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { AdminLinkComponent } from "./admin/types";
export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}
export function Breadcrumb({
  items,
  label = "Ruta de navegación",
  LinkComponent = "a",
}: {
  items: readonly BreadcrumbItem[];
  label?: string;
  LinkComponent?: AdminLinkComponent;
}) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center gap-1.5 text-sm">
            {index > 0 && (
              <ChevronRight aria-hidden="true" className="size-4 text-gray-500 rtl:rotate-180" />
            )}
            {item.href ? (
              <LinkComponent
                href={item.href}
                className="text-gray-500 hover:text-brand-500 dark:text-gray-400"
              >
                {item.label}
              </LinkComponent>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
                className="text-gray-800 dark:text-white/90"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
