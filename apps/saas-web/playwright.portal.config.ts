import { defineConfig, devices } from "@playwright/test";

/** Portal regression tests with HTTP fixtures; no SUNAT or database required. */
export default defineConfig({
  testDir: "./portal-e2e",
  testMatch: "configuration.spec.ts",
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5184",
    ...devices["Desktop Chrome"],
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm exec vite preview --host localhost --port 5184 --strictPort",
    url: "http://localhost:5184",
    reuseExistingServer: false,
  },
});
