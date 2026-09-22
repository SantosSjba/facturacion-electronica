import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { SidebarProvider, useSidebar } from "@/app/sidebar-context";

import { Dialog, DialogBody, DialogFooter, DialogHeader } from "./components/dialog";
import { Table, TBody, TD, TH, THead, TR } from "./components/table";
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

  it("keeps input focus while typing even when onClose identity changes each render", () => {
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <Dialog open onClose={() => undefined} ariaLabel="Formulario">
          <DialogBody>
            <input
              aria-label="Razón social"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </DialogBody>
        </Dialog>
      );
    }

    render(<Harness />);
    const input = screen.getByLabelText("Razón social");
    input.focus();
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.change(input, { target: { value: "Ac" } });
    fireEvent.change(input, { target: { value: "Acm" } });
    expect((input as HTMLInputElement).value).toBe("Acm");
    expect(document.activeElement).toBe(input);
  });

  it("renders responsive table cells with mobile labels and actions", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH>Nombre</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD label="Nombre">Acme</TD>
            <TD actions>
              <button type="button">Editar</button>
            </TD>
          </TR>
        </TBody>
      </Table>,
    );

    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getAllByText("Nombre").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(document.querySelector("td[data-actions]")).toBeTruthy();
  });
});
