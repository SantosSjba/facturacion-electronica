import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/portal-e2e/fixtures/ui.html");
});

test("loading scenarios announce status, hide fake controls, respect reduced motion and fit mobile", async ({
  page,
}, testInfo) => {
  await page.goto("/portal-e2e/fixtures/ui.html?loading");
  for (const variant of [
    "table",
    "cards",
    "detail",
    "form",
    "list",
    "documents",
    "dashboard",
    "page",
  ]) {
    const region = page.locator(`[data-skeleton="${variant}"]`);
    await expect(region).toHaveAttribute("role", "status");
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(region).toContainText(`Cargando ${variant}`);
    await expect(region.getByRole("button")).toHaveCount(0);
    await expect(region.getByRole("textbox")).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Guardando…" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-skeleton="table"] .bg-gray-200').first()).toHaveCSS(
    "animation-name",
    "none",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`loading-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.locator('[data-skeleton="table"]').screenshot({ path: testInfo.outputPath(`table-${width}.png`), animations: "disabled" });
  }
  await page.getByRole("button", { name: "Cambiar tema" }).click();
  await page.screenshot({
    path: testInfo.outputPath("loading-mobile-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator('[data-skeleton="form"]').screenshot({ path: testInfo.outputPath("form-mobile-dark.png"), animations: "disabled" });
});

test("shared fields keep controlled values, native form semantics and keyboard access", async ({
  page,
}) => {
  await page.getByLabel("Empresa", { exact: true }).fill("Empresa API SAC");
  await page.getByLabel("Notas", { exact: true }).fill("Solo API");
  await page.getByLabel("Estado", { exact: true }).selectOption("inactive");
  await page.getByLabel("Aceptar condiciones").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("checked-value")).toHaveText("true");
  await page.getByRole("switch", { name: "Webhook activo" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("switch-value")).toHaveText("true");
  await expect(page.getByLabel("Casilla deshabilitada")).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Switch deshabilitado" })).toBeDisabled();
  await page.getByLabel("Producción", { exact: true }).check();
  await expect(page.getByTestId("radio-value")).toHaveText("production");
  await page.getByRole("combobox", { name: "Roles" }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("roles-value")).toHaveText("admin");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("roles-value")).toHaveText("admin,viewer");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Quitar Administrador" }).click();
  await expect(page.getByTestId("roles-value")).toHaveText("viewer");
  await page.getByLabel("Teléfono").fill("987654321");
  await page.getByLabel("País", { exact: true }).selectOption("CL");
  await expect(page.getByLabel("Teléfono")).toHaveValue("987654321");
  await expect(page.getByLabel("RUC", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("RUC", { exact: true })).toHaveAccessibleDescription("RUC inválido");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("selected-value")).toHaveText("guardado");
});

test("TailAdmin dates and file inputs synchronize and validate actual selections", async ({
  page,
}) => {
  await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue("2026-10-08");
  await page.getByRole("button", { name: "Cambiar fecha" }).click();
  await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue("2026-10-15");
  await page.getByLabel("Fecha", { exact: true }).click();
  await expect(page.locator(".flatpickr-calendar.open")).toBeVisible();
  await page
    .locator(".flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)")
    .filter({ hasText: /^20$/ })
    .click();
  await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue("2026-10-20");
  await page.getByLabel("Certificado", { exact: true }).setInputFiles({
    name: "empresa.pfx",
    mimeType: "application/x-pkcs12",
    buffer: Buffer.from("certificate"),
  });
  await expect(page.getByTestId("file-value")).toHaveText("empresa.pfx");
  const dropInput = page.getByTestId("dropzone").locator('input[type="file"]');
  await dropInput.setInputFiles({
    name: "rechazado.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByTestId("reject-value")).toHaveText("rechazado.txt");
  await dropInput.setInputFiles({
    name: "valido.pfx",
    mimeType: "application/x-pkcs12",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByTestId("drop-value")).toHaveText("valido.pfx");
  await dropInput.setInputFiles({
    name: "grande.pfx",
    mimeType: "application/x-pkcs12",
    buffer: Buffer.alloc(1025),
  });
  await expect(page.getByTestId("reject-value")).toHaveText("grande.pfx");
  await page.getByTestId("dropzone").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "arrastrado.pfx", { type: "application/x-pkcs12" }));
    element.firstElementChild?.dispatchEvent(
      new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }),
    );
  });
  await expect(page.getByTestId("drop-value")).toHaveText("arrastrado.pfx");
});

test("modals keep typing focus, trap Tab, restore focus; dropdowns and tabs support keyboard", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Abrir modal" });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Editar empresa" });
  await expect(modal).toBeFocused();
  await modal.getByLabel("Nombre en modal").pressSequentially("Empresa", { delay: 30 });
  await expect(modal.getByLabel("Nombre en modal")).toHaveValue("Empresa");
  await modal.getByRole("button", { name: "Confirmar" }).focus();
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "Cerrar diálogo" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "Confirmar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Acciones", exact: true }).click();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Archivar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Acciones", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "General" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Seguridad" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel")).toHaveText("Opciones de seguridad");
});

test("shared catalogue fits desktop and mobile in both themes", async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Componentes TailAdmin" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`ui-${width}-light.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      "rgb(16, 24, 40)",
    );
    await page.screenshot({
      path: testInfo.outputPath(`ui-${width}-dark.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
  }
});
