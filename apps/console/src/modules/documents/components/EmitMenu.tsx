import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  FileMinus2,
  FilePlus2,
  FileText,
  FileX2,
  Layers,
  Receipt,
  Send,
} from "lucide-react";

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
    to: "/documents/emit/invoice",
    label: "Factura",
    code: "01",
    description: "Comprobante a RUC",
    Icon: FileText,
    testId: "emit-invoice",
  },
  {
    to: "/documents/emit/receipt",
    label: "Boleta",
    code: "03",
    description: "Comprobante a DNI / consumidor",
    Icon: Receipt,
  },
  {
    to: "/documents/emit/credit-note",
    label: "Nota de crédito",
    code: "07",
    description: "Anula o reduce un CPE previo",
    Icon: FileMinus2,
  },
  {
    to: "/documents/emit/debit-note",
    label: "Nota de débito",
    code: "08",
    description: "Aumenta el importe de un CPE",
    Icon: FilePlus2,
  },
  {
    to: "/documents/emit/voided",
    label: "Comunicación de baja",
    code: "RA",
    description: "Da de baja comprobantes del día",
    Icon: FileX2,
  },
  {
    to: "/documents/emit/daily-summary",
    label: "Resumen diario",
    code: "RC",
    description: "Envía el resumen de boletas",
    Icon: Layers,
  },
] as const;

export function EmitMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon-label-sm"
        aria-label="Emitir comprobante"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="emit-menu"
        onClick={() => setOpen(true)}
      >
        <Send className={buttonIconClassName} />
        <ButtonLabel>Emitir</ButtonLabel>
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Emitir comprobante"
        size="md"
      >
        <DialogHeader
          title="Emitir comprobante"
          description="Elige el tipo de CPE a emitir."
          onClose={() => setOpen(false)}
        />
        <DialogBody className="space-y-1.5 pt-3!">
          {EMIT_LINKS.map((item) => {
            const { to, label, code, description, Icon } = item;
            const testId = "testId" in item ? item.testId : undefined;
            return (
              <Link
                key={to}
                to={to}
                data-testid={testId}
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
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
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
            );
          })}
        </DialogBody>
      </Dialog>
    </>
  );
}
