import { expect, test } from "@playwright/test";

import { loginAs, softNavigate } from "./helpers/auth";
import { testIds } from "./helpers/selectors";

test.describe("FE-310 E2E por rol", () => {
  test("owner sees write nav and Emitir", async ({ page }) => {
    await loginAs(page, "owner");
    await expect(page.getByTestId(testIds.nav("users"))).toBeVisible();
    await expect(page.getByTestId(testIds.nav("apikeys"))).toBeVisible();
    await expect(page.getByTestId(testIds.nav("documents"))).toBeVisible();

    await page.getByTestId(testIds.nav("documents")).click();
    await expect(page.getByTestId(testIds.emitMenu)).toBeVisible();
    await page.getByTestId(testIds.emitMenu).click();
    await expect(page.getByTestId(testIds.emitInvoice)).toBeVisible();
    await page.getByTestId(testIds.emitInvoice).click();
    await expect(page).toHaveURL(/\/documents\/emit\/invoice/);
    await expect(page.getByTestId(testIds.wizardCompany)).toBeVisible();
  });

  test("viewer hides write nav and Emitir", async ({ page }) => {
    await loginAs(page, "viewer");
    await expect(page.getByTestId(testIds.nav("companies"))).toBeVisible();
    await expect(page.getByTestId(testIds.nav("documents"))).toBeVisible();
    await expect(page.getByTestId(testIds.nav("users"))).toHaveCount(0);
    await expect(page.getByTestId(testIds.nav("apikeys"))).toHaveCount(0);
    await expect(page.getByTestId(testIds.nav("webhooks"))).toHaveCount(0);
    await expect(page.getByTestId(testIds.nav("audit"))).toHaveCount(0);
    await expect(page.getByTestId(testIds.nav("validations"))).toHaveCount(0);

    await page.getByTestId(testIds.nav("documents")).click();
    await expect(page.getByTestId(testIds.emitMenu)).toHaveCount(0);
  });

  test("viewer deep-links do not expose write CTAs", async ({ page }) => {
    await loginAs(page, "viewer");

    await softNavigate(page, "/users");
    await expect(page).toHaveURL(/\/users/);
    await expect(page.getByRole("button", { name: /Invitar|crear/i })).toHaveCount(
      0,
    );

    await softNavigate(page, "/developers/api-keys");
    await expect(page).toHaveURL(/\/developers\/api-keys/);
    await expect(page.getByRole("button", { name: /Nueva API key/i })).toHaveCount(
      0,
    );

    await softNavigate(page, "/documents/emit/invoice");
    await expect(page).toHaveURL(/\/documents\/emit\/invoice/);
    await expect(page.getByTestId(testIds.wizardSubmit)).toHaveCount(0);
    await expect(page.getByTestId(testIds.wizardCompany)).toHaveCount(0);
    await expect(
      page.getByText(/No tienes permiso|documents:write/i),
    ).toBeVisible();
  });
});
