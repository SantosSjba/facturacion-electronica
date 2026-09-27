import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Truck } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

const EMIT_LINKS = [
  {
    to: "/gre/emit/09",
    label: "GRE Remitente",
    code: "09",
    description: "Guía de remisión del remitente",
  },
  {
    to: "/gre/emit/31",
    label: "GRE Transportista",
    code: "31",
    description: "Guía de remisión del transportista",
  },
] as const;

export function EmitGreMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon-label-sm"
        aria-label="Emitir GRE"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Truck className={buttonIconClassName} />
        <ButtonLabel>Emitir GRE</ButtonLabel>
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Emitir GRE"
        size="sm"
      >
        <DialogHeader
          title="Emitir GRE"
          description="Elige el tipo de guía de remisión."
          onClose={() => setOpen(false)}
        />
        <DialogBody className="space-y-1.5 pt-3!">
          {EMIT_LINKS.map(({ to, label, code, description }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3 transition-colors",
                "hover:border-brand-300 hover:bg-brand-50/60",
                "dark:border-gray-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                  "dark:bg-brand-500/15 dark:text-brand-400",
                )}
                aria-hidden
              >
                <Truck className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                    {label}
                  </span>
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                    {code}
                  </span>
                </span>
                <MutedText as="span" className="mt-0.5 block text-theme-xs">
                  {description}
                </MutedText>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-gray-400 group-hover:text-brand-500"
                aria-hidden
              />
            </Link>
          ))}
        </DialogBody>
      </Dialog>
    </>
  );
}
