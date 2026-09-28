import type { Page } from "@playwright/test";

import { PLATFORM, testIds } from "./selectors";

/** Drop SPA session so public auth routes (accept-invite) are not redirected. */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.removeItem("factosys.refresh_token");
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto("/auth/login");
  await page.getByTestId(testIds.loginEmail).waitFor({ timeout: 15_000 });
}

export async function loginAsPlatform(page: Page): Promise<void> {
  await page.goto("/auth/login");
  await page.getByTestId(testIds.loginEmail).fill(PLATFORM.email);
  await page.getByTestId(testIds.loginPassword).fill(PLATFORM.password);
  await page.getByTestId(testIds.loginSubmit).click();
  // Org picker may appear if multi-org; prefer platform slug.
  const orgBtn = page.getByTestId(testIds.loginOrg(PLATFORM.orgSlug));
  if (await orgBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await orgBtn.click();
  }
  await page.waitForURL((url) => url.pathname.startsWith("/platform"), {
    timeout: 25_000,
  });
}

export async function loginAsOrg(
  page: Page,
  input: { email: string; password: string; organizationId?: string },
): Promise<void> {
  await page.goto("/auth/login");
  await page.getByTestId(testIds.loginEmail).fill(input.email);
  await page.getByTestId(testIds.loginPassword).fill(input.password);
  await page.getByTestId(testIds.loginSubmit).click();
  if (input.organizationId) {
    const orgBtn = page.getByTestId(`login-org-${input.organizationId}`);
    // Slug-based id preferred; fallback: click first org choice if shown
    if (await orgBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await orgBtn.click();
    } else {
      const anyOrg = page.locator("[data-testid^='login-org-']").first();
      if (await anyOrg.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await anyOrg.click();
      }
    }
  }
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/app") ||
      url.pathname.startsWith("/auth") === false,
    { timeout: 25_000 },
  );
}

/** SPA soft navigate — keeps in-memory access token. */
export async function softNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
