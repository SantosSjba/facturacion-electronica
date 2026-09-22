import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "./theme-context";

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="top-right"
      visibleToasts={3}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "border border-gray-200 bg-white text-gray-800 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 dark:text-white/90",
          description: "text-gray-500 dark:text-gray-400",
          closeButton:
            "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
