import { Toaster as SharedToaster, type ToasterProps } from "@factosys/ui";

import { useTheme } from "./theme-context";

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return <SharedToaster theme={theme} {...props} />;
}

export { toast } from "@factosys/ui";
