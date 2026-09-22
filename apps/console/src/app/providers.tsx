import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { SessionProvider } from "@/shared/auth/session-context";
import { ThemeProvider } from "@/shared/ui/theme-context";
import { Toaster } from "@/shared/ui/toaster";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
