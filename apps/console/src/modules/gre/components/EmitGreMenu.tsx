import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Truck } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";

const EMIT_LINKS = [
  { to: "/gre/emit/09", label: "GRE Remitente (09)" },
  { to: "/gre/emit/31", label: "GRE Transportista (31)" },
] as const;

export function EmitGreMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        size="icon-label-sm"
        aria-label="Emitir GRE"
        onClick={() => setOpen((v) => !v)}
      >
        <Truck className={buttonIconClassName} />
        <ButtonLabel>Emitir GRE</ButtonLabel>
        <ChevronDown className={buttonIconClassName} />
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
