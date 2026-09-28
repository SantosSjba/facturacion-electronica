import { expect, test } from "@playwright/test";

import { loginAsPlatform } from "./helpers/auth";
import { testIds } from "./helpers/selectors";

test.describe("S17-QA FE-481 platform login", () => {
  test("logs in as platform admin and lands on /platform", async ({ page }) => {
    await loginAsPlatform(page);
    await expect(page).toHaveURL(/\/platform/);
    await expect(page.getByTestId(testIds.nav("dashboard"))).toBeVisible();
  });
});
