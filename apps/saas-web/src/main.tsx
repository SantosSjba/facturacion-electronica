import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { SessionProvider } from "@/shared/auth/session-context";
import { ThemeProvider } from "@/shared/ui/theme-context";
import { Toaster } from "@/shared/ui/toaster";

import { AppRouter } from "./app/router";
import "./index.css";

function Root() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <SessionProvider>
          <BrowserRouter>
            <AppRouter />
            <Toaster />
          </BrowserRouter>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
