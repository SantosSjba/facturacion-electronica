import { expect, test, type Page } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const company = {
  id: companyId,
  organization_id: "portal-org",
  ruc: "20100070970",
  legal_name: "Empresa API SAC",
  trade_name: null,
  environment: "sandbox",
  status: "active",
  address: null,
  catalog_pin: {},
  timezone: "America/Lima",
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
  certificate_status: "missing",
  sol_configured: false,
  gre_configured: false,
};
const ownerPermissions = [
  "companies:read",
  "companies:write",
  "credentials:manage",
  "series:read",
  "series:write",
  "apikeys:manage",
  "webhooks:manage",
];

async function preparePortal(page: Page, perms = ownerPermissions) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: "portal-owner",
      org: "portal-org",
      email: "owner@example.com",
      perms,
      roles: ["owner"],
      ctx: "org",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  await page.addInitScript(() => localStorage.setItem("factosys.refresh_token", "portal-fixture"));
  const writes: { path: string; body: string; contentType: string }[] = [];
  await page.route("http://localhost:3000/**", async (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const headers = {
      "access-control-allow-origin": "http://localhost:5184",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (req.method() !== "GET")
      writes.push({
        path: pathname,
        body: req.postData() ?? "",
        contentType: req.headers()["content-type"] ?? "",
      });
    let json: unknown;
    if (pathname === "/auth/refresh")
      json = {
        access_token: `fixture.${payload}.fixture`,
        refresh_token: "portal-fixture",
        expires_in: 3600,
      };
    else if (pathname === "/saas/onboarding/status")
      json = {
        complete: true,
        has_company: true,
        requires_reaccept: false,
      };
    else if (pathname === "/companies") json = req.method() === "POST" ? company : [company];
    else if (pathname === `/companies/${companyId}`) json = company;
    else if (pathname.endsWith("/series")) json = [];
    else if (pathname.endsWith("/certificate")) {
      await route.fulfill({ status: 204, headers });
      return;
    } else if (pathname === "/organizations/me/api-keys")
      json =
        req.method() === "POST"
          ? { id: "key-1", name: "ERP", secret: "fixture-key-secret", scopes: ["documents:read"] }
          : [];
    else if (pathname === "/v1/webhook-endpoints")
      json = [
        {
          id: "webhook-1",
          url: "https://example.com/events",
          status: "active",
          events: ["document.status_changed"],
          created_at: company.created_at,
          secret_hint: "***",
          consecutive_failures: 0,
        },
      ];
    else if (pathname.endsWith("/deliveries")) json = [];
    else if (pathname.startsWith("/organizations/me/notifications"))
      json = { items: [], unread_count: 0 };
    else throw new Error(`Unexpected portal API request: ${req.method()} ${pathname}`);
    await route.fulfill({ json, headers });
  });
  return writes;
}

test("company registration stays in the portal and keeps API endpoints", async ({ page }) => {
  const writes = await preparePortal(page);
  await page.goto("/app/companies");
  await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Crear empresa", exact: true }).click();
  await page.getByRole("dialog").getByLabel("RUC", { exact: true }).fill(company.ruc);
  await page.getByLabel("Razón social").fill(company.legal_name);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page).toHaveURL(`/app/companies/${companyId}/series`);
  expect(writes.find((w) => w.path === "/companies")?.body).toContain('"seed_default_series":true');
  await page.getByRole("link", { name: "Certificado", exact: true }).click();
  await expect(page).toHaveURL(`/app/companies/${companyId}/certificate`);
  await expect(page.getByRole("button", { name: "Subir PFX" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Emitir|Consola/ })).toHaveCount(0);
});

test("certificate upload preserves authenticated multipart transport", async ({ page }) => {
  const writes = await preparePortal(page);
  await page.goto(`/app/companies/${companyId}/certificate`);
  await page.getByRole("button", { name: "Subir PFX" }).click();
  await page.getByLabel("Archivo", { exact: true }).setInputFiles({
    name: "fixture.pfx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("fixture-certificate"),
  });
  await page.getByLabel("Contraseña (write-only)", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Subir certificado", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const upload = writes.find((w) => w.path.endsWith("/certificate"));
  expect(upload?.contentType).toContain("multipart/form-data; boundary=");
  expect(upload?.body).toContain('name="password"');
  expect(upload?.body).toContain('filename="fixture.pfx"');
});

test("API keys and webhook deliveries work without a separate console", async ({ page }) => {
  const writes = await preparePortal(page);
  await page.goto("/app/developers/api-keys");
  await page.getByRole("button", { name: "Nueva API key", exact: true }).first().click();
  await page.getByLabel("Nombre", { exact: true }).fill("ERP");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue("fixture-key-secret");
  expect(writes.find((w) => w.path === "/organizations/me/api-keys")?.body).toContain(
    '"documents:read"',
  );
  await page.goto("/app/developers/webhooks");
  await page.getByRole("link", { name: "Ver entregas", exact: true }).click();
  await expect(page).toHaveURL("/app/developers/webhooks/webhook-1/deliveries");
  await expect(page.getByRole("heading", { name: "Entregas del webhook" })).toBeVisible();
});

test("viewer cannot manage keys using a direct URL", async ({ page }) => {
  await preparePortal(page, ["companies:read"]);
  await page.goto("/app/developers/api-keys");
  await expect(page.getByText("No tienes permiso para acceder a esta sección.")).toBeVisible();
  await expect(page.getByRole("link", { name: "API keys", exact: true })).toHaveCount(0);
  await page.goto(`/app/companies/${companyId}/certificate`);
  await expect(page.getByText("Estado del certificado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir PFX" })).toHaveCount(0);
});
