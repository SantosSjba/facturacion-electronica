import type { LucideIcon } from "lucide-react";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { ActionButton } from "./action-button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmIcon?: LucideIcon;
  cancelLabel?: string;
  /** `destructive` paints the confirm action red. */
  tone?: "primary" | "destructive";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Small confirmation modal — replaces `window.confirm` with an on-brand dialog. */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  confirmIcon = Check,
  cancelLabel = "Cancelar",
  tone = "primary",
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const close = () => {
    if (!pending) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      ariaLabel={title}
      size="sm"
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
    >
      <DialogHeader title={title} description={description} onClose={close} />
      {children || error ? (
        <DialogBody className="space-y-2">
          {children}
          {error ? <p className="text-sm text-error-600 dark:text-error-500">{error}</p> : null}
        </DialogBody>
      ) : null}
      <DialogFooter>
        <ActionButton
          size="default"
          icon={X}
          label={cancelLabel}
          disabled={pending}
          onClick={close}
        />
        <ActionButton
          size="default"
          variant={tone === "destructive" ? "destructive" : "primary"}
          icon={confirmIcon}
          label={confirmLabel}
          pending={pending}
          onClick={onConfirm}
        />
      </DialogFooter>
    </Dialog>
  );
}
