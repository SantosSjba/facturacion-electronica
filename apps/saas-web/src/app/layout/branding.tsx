import { Link } from "react-router-dom";
import type { AdminLinkProps } from "@factosys/ui";

export function PortalLink({ href, children, ...props }: AdminLinkProps) {
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}
export function PortalLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex h-10 items-center gap-2.5" aria-label="Factosys">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
        FS
      </span>
      {!compact && (
        <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Factosys
        </span>
      )}
    </span>
  );
}
