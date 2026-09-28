import { expect, test } from "@playwright/test";

import {
  createPublicSignup,
  makeValidUniqueRuc,
} from "./helpers/api";
import { loginAsPlatform } from "./helpers/auth";
import { testIds } from "./helpers/selectors";

test.describe("S17-QA FE-482 signup approve", () => {
  test("platform UI: under_review → approve", async ({ page }) => {
    const stamp = Date.now();
    const ruc = makeValidUniqueRuc(stamp);
    const email = `pw-approve-${stamp}@example.com`;
    const created = await createPublicSignup({
      companyName: `PW Approve SAC ${stamp}`,
      ruc,
      contactEmail: email,
    });

    await loginAsPlatform(page);
    await page.goto(`/platform/signup-requests/${created.id}`);
    await expect(page.getByTestId(testIds.signupMarkReview)).toBeVisible();
    await page.getByTestId(testIds.signupMarkReview).click();
    await expect(page.getByTestId(testIds.signupApprove)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(testIds.signupApprove).click();
    await expect(page.getByTestId(testIds.signupApproved)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(testIds.signupOrgId)).toBeVisible();
  });
});
