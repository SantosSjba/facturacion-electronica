import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { testIds } from "./helpers/selectors";

test.describe("FE-312 E2E emitir mock", () => {
  test("login → wizard factura → accepted (Fake CDR)", async ({ page }) => {
    await loginAs(page, "owner");
    await page.getByTestId(testIds.nav("documents")).click();
    await page.getByTestId(testIds.emitMenu).click();
    await page.getByTestId(testIds.emitInvoice).click();

    await expect(page.getByTestId(testIds.wizardCompany)).toBeVisible();
    const companySelect = page.getByTestId(testIds.wizardCompany);
    const options = companySelect.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
    // Select first non-empty company
    const value = await options.nth(1).getAttribute("value");
    await companySelect.selectOption(value!);

    await expect(page.getByTestId(testIds.wizardSerie)).not.toBeDisabled({
      timeout: 10_000,
    });
    await page.getByTestId(testIds.wizardSerie).selectOption("F001");

    await page.getByTestId(testIds.wizardNext).click();

    await page.getByTestId(testIds.wizardCustomerNumber).fill("20123456789");
    await page.getByTestId(testIds.wizardCustomerName).fill("ACME E2E SAC");
    await page.getByTestId(testIds.wizardNext).click();

    await page.getByTestId(testIds.wizardLineDescription).fill("Servicio E2E Fake");
    await page.getByTestId(testIds.wizardLineQuantity).fill("1");
    await page.getByTestId(testIds.wizardLineUnitValue).fill("100");
    await page.getByTestId(testIds.wizardNext).click();

    // Extras (optional)
    await page.getByTestId(testIds.wizardNext).click();

    await page.getByTestId(testIds.wizardSubmit).click();

    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}/i, {
      timeout: 60_000,
    });

    const status = page.getByTestId(testIds.documentStatus);
    await expect(status).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => (await status.textContent())?.trim() ?? "", {
        timeout: 60_000,
      })
      .toMatch(/accepted(_with_observation)?/);

    await expect(page.getByTestId(testIds.artifactXml)).toBeVisible();
    await expect(page.getByTestId(testIds.artifactCdr)).toBeVisible();
    await expect(page.getByTestId(testIds.artifactPdf)).toBeVisible();
  });
});
