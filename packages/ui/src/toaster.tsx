import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Shared notifications; the consuming app supplies its current theme. */
export function Toaster({ toastOptions, style, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      richColors
      closeButton
      position="top-right"
      visibleToasts={3}
      containerAriaLabel="Notificaciones"
      style={{ fontFamily: "var(--font-outfit, sans-serif)", ...style }}
      {...props}
      toastOptions={{
        duration: 5000,
        closeButtonAriaLabel: "Cerrar notificación",
        ...toastOptions,
        classNames: {
          toast:
            "border border-gray-200 bg-white text-gray-800 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 dark:text-white/90",
          description: "text-gray-500 dark:text-gray-400",
          closeButton:
            "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
          ...toastOptions?.classNames,
        },
      }}
    />
  );
}

export { toast } from "sonner";
export type { ToasterProps, ExternalToast } from "sonner";
