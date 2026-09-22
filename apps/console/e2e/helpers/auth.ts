import type { Page } from "@playwright/test";

import { DEMO, testIds } from "./selectors";

export type DemoRole = "owner" | "viewer";

export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  const creds = role === "owner" ? DEMO.owner : DEMO.viewer;
  await page.goto("/login");
  await page.getByTestId(testIds.loginOrg).fill(DEMO.org);
  await page.getByTestId(testIds.loginEmail).fill(creds.email);
  await page.getByTestId(testIds.loginPassword).fill(creds.password);
  await page.getByTestId(testIds.loginSubmit).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 20_000,
  });
}

/** SPA soft navigate — keeps in-memory access token (avoids full reload logout). */
export async function softNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
