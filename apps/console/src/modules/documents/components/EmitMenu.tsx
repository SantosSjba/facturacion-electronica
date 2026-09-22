import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

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
      <Button type="button" size="sm" onClick={() => setOpen((v) => !v)}>
        Emitir
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-800 dark:bg-gray-900">
          {EMIT_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="block px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/5"
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
