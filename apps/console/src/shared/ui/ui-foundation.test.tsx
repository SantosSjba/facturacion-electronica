import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, useSidebar } from "@/app/sidebar-context";

import { Dialog, DialogBody, DialogFooter, DialogHeader } from "./components/dialog";
import { ThemeProvider, useTheme } from "./theme-context";

function SidebarHarness() {
  const { isExpanded, isMobile, toggleSidebar } = useSidebar();
  return (
    <button type="button" onClick={toggleSidebar}>
      {isMobile ? "mobile" : isExpanded ? "expanded" : "compact"}
    </button>
  );
}

function ThemeHarness() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

describe("TailAdmin UI foundation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
  });

  it("toggles and persists the desktop sidebar state", async () => {
    render(
      <SidebarProvider>
        <SidebarHarness />
      </SidebarProvider>,
    );

    expect(screen.getByRole("button").textContent).toContain("expanded");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toContain("compact");
    await waitFor(() => expect(window.localStorage.getItem("factosys-sidebar")).toBe("compact"));
  });

  it("toggles dark mode and stores the preference", async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(screen.getByRole("button", { name: "dark" })).toBeTruthy();
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(window.localStorage.getItem("factosys-theme")).toBe("dark");
    });
  });

  it("composes a reusable header, body and footer and closes with Escape", () => {
    const onClose = vi.fn();

    render(
      <Dialog open onClose={onClose} ariaLabel="Modal de prueba">
        <DialogHeader title="Cabecera" onClose={onClose} />
        <DialogBody>Contenido reutilizable</DialogBody>
        <DialogFooter>
          <button type="button">Acción</button>
        </DialogFooter>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Modal de prueba" })).toBeTruthy();
    expect(screen.getByText("Cabecera")).toBeTruthy();
    expect(screen.getByText("Contenido reutilizable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Acción" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
