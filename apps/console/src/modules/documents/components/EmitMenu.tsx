import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

const EMIT_LINKS = [
  { to: "/documents/emit/invoice", label: "Factura (01)" },
  { to: "/documents/emit/receipt", label: "Boleta (03)" },
  { to: "/documents/emit/credit-note", label: "Nota de crédito (07)" },
  { to: "/documents/emit/debit-note", label: "Nota de débito (08)" },
  { to: "/documents/emit/voided", label: "Comunicación de baja (RA)" },
  { to: "/documents/emit/daily-summary", label: "Resumen diario (RC)" },
] as const;

export function EmitMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
      >
        Emitir
        <ChevronDown className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-md">
          {EMIT_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="block px-3 py-2 text-sm hover:bg-[var(--muted)]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
