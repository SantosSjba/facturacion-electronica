import type { ReactNode } from "react";
import { Dialog, type DialogSize } from "./dialog";
import { CloseIcon } from "./admin/icons";
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  size?: DialogSize;
  showCloseButton?: boolean;
  closeLabel?: string;
}
export function Modal({
  isOpen,
  onClose,
  ariaLabel,
  children,
  className,
  size = "lg",
  showCloseButton = true,
  closeLabel = "Cerrar diálogo",
}: ModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} ariaLabel={ariaLabel} size={size} className={className}>
      {showCloseButton && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute end-3 top-3 z-10 flex size-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 sm:end-6 sm:top-6 sm:size-11 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <CloseIcon />
        </button>
      )}
      <div className="overflow-y-auto p-6 sm:p-8">{children}</div>
    </Dialog>
  );
}
