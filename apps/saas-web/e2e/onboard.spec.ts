import { expect, test } from "@playwright/test";

import {
  createPublicSignup,
  makeValidUniqueRuc,
  platformLogin,
  waitInviteToken,
} from "./helpers/api";
import { API_BASE, testIds } from "./helpers/selectors";
import { clearAuth, loginAsOrg, loginAsPlatform } from "./helpers/auth";

test.describe("S17-QA FE-483 onboard", () => {
  test("approve → accept-invite → onboarding wizard → /app", async ({
    page,
  }) => {
    const stamp = Date.now();
    const ruc = makeValidUniqueRuc(stamp + 11);
    const email = `pw-onboard-${stamp}@example.com`;
    const password = "OwnerInvite!2026";

    const created = await createPublicSignup({
      companyName: `PW Onboard SAC ${stamp}`,
      ruc,
      contactEmail: email,
    });

    await loginAsPlatform(page);
    await page.goto(`/platform/signup-requests/${created.id}`);
    await page.getByTestId(testIds.signupMarkReview).click();
    await expect(page.getByTestId(testIds.signupApprove)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(testIds.signupApprove).click();
    await expect(page.getByTestId(testIds.signupOrgId)).toBeVisible({
      timeout: 20_000,
    });
    const orgId = (
      await page.getByTestId(testIds.signupOrgId).textContent()
    )?.trim();
    expect(orgId).toBeTruthy();

    const platformToken = await platformLogin();
    const inviteToken = await waitInviteToken(platformToken, email);

    await clearAuth(page);
    await page.goto(`/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`);
    await page.getByTestId(testIds.invitePassword).fill(password);
    await page.getByTestId(testIds.inviteConfirm).fill(password);
    await page.getByTestId(testIds.inviteSubmit).click();
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });

    await loginAsOrg(page, {
      email,
      password,
      organizationId: orgId!,
    });

    await expect(page).toHaveURL(/\/app\/onboarding/, { timeout: 20_000 });
    await page.getByTestId(testIds.onbWelcomeNext).click();
    await page.getByTestId(testIds.onbRuc).fill(ruc);
    await page.getByTestId(testIds.onbLegalName).fill(`PW Onboard SAC ${stamp}`);
    await page.getByTestId(testIds.onbCreateCompany).click();
    // After company create, RedirectIfOnboarded → /app + LegalReacceptModal
    await expect(page).toHaveURL(/\/app\/?$/, { timeout: 20_000 });
    await expect(page.getByTestId(testIds.legalReacceptSubmit)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(testIds.legalReacceptPrivacy).check();
    await page.getByTestId(testIds.legalReacceptTerms).check();
    await page.getByTestId(testIds.legalReacceptSubmit).click();
    await expect(page.getByTestId(testIds.legalReacceptSubmit)).toBeHidden({
      timeout: 15_000,
    });

    // Sanity: onboarding complete via API
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        organization_id: orgId,
      }),
    });
    const loginBody = (await loginRes.json()) as { access_token: string };
    const statusRes = await fetch(`${API_BASE}/saas/onboarding/status`, {
      headers: { Authorization: `Bearer ${loginBody.access_token}` },
    });
    const status = (await statusRes.json()) as { complete: boolean };
    expect(status.complete).toBe(true);
  });
});
