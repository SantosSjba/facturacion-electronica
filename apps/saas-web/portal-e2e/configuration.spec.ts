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

for (const scenario of [
  { name: "credentials", status: 401, code: "FACTOSYS_UNAUTHORIZED", message: "Invalid credentials", expected: "El correo o la contraseña son incorrectos." },
  { name: "rate limit", status: 429, code: "FACTOSYS_RATE_LIMITED", message: "Login rate limit exceeded", expected: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." },
  { name: "server", status: 500, code: "FACTOSYS_INTERNAL", message: "Internal server error", expected: "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde." },
  { name: "network", status: 0, code: "", message: "", expected: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo." },
]) {
  test(`login shows Spanish errors only in shared toasts: ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("http://localhost:3000/auth/login", async (route) => {
      const headers = {
        "access-control-allow-origin": "http://localhost:5184",
        "access-control-allow-headers": "content-type,accept",
        "access-control-allow-methods": "POST,OPTIONS",
      };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (!scenario.status) return route.abort("failed");
      return route.fulfill({
        status: scenario.status,
        headers,
        json: { code: scenario.code, message: scenario.message },
      });
    });
    await page.goto("/auth/login");
    await page.getByTestId("login-email").fill("platform@factosysperu.com");
    await page.getByTestId("login-password").fill("WrongPassword!2026");
    await page.getByTestId("login-submit").click();
    const notice = page.locator("[data-sonner-toast]");
    await expect(notice).toContainText(scenario.expected);
    await expect(notice).toHaveCSS("opacity", "1");
    await expect(page.getByText(scenario.expected, { exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Error de acceso" })).toHaveCount(0);
    await expect(page.getByTestId("login-submit")).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("login-toast-mobile.png"), animations: "disabled" });
    await notice.getByRole("button", { name: "Cerrar notificación" }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByText(scenario.expected, { exact: true })).toHaveCount(0);
    if (scenario.name === "credentials") {
      await page.getByRole("button", { name: "Activar tema oscuro" }).click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByTestId("login-submit").click();
      await expect(notice).toHaveCount(1);
      await expect(notice).toContainText(scenario.expected);
      await expect(notice).toHaveCSS("opacity", "1");
      await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute("data-sonner-theme", "dark");
      await page.screenshot({ path: testInfo.outputPath("login-toast-desktop-dark.png"), animations: "disabled" });
    }
  });
}

async function preparePortal(
  page: Page,
  perms = ownerPermissions,
  ctx: "org" | "platform" = "org",
  pending?: { path: string; wait: Promise<void>; fail?: boolean },
) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: "portal-owner",
      org: "portal-org",
      email: "owner@example.com",
      perms,
      roles: [ctx === "platform" ? "platform_admin" : "owner"],
      ctx,
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
    if (pending && req.method() === "GET" && pathname === pending.path) {
      await pending.wait;
      if (pending.fail) {
        await route.fulfill({ status: 403, json: { message: "Sin acceso" }, headers });
        return;
      }
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
    else if (pathname === "/saas/platform/audit-events") json = { items: [], next_cursor: null };
    else if (pathname === "/organizations/me/plan") json = {
      organization_id: "portal-org", plan: { name: "Starter" },
      limits: { max_companies: 3, max_users: 2, max_documents_per_month: 100, max_api_keys: 1 }, usage: { companies: 1, users: 1, documents_this_month: 0, api_keys: 0 },
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

for (const decision of ["approve", "reject"] as const) {
  test(`platform reviews and resolves a plan change: ${decision}`, async ({ page }, testInfo) => {
    await preparePortal(page, ["platform:admin"], "platform");
    const item = {
      id: "plan-change-1", organization_id: company.organization_id,
      organization_name: "Empresa API SAC", organization_slug: "empresa-api",
      requested_by_email: "cliente@factosysperu.com", current_plan_name: null,
      requested_plan_name: "Starter", requested_plan_code: "starter",
      message: "Necesitamos activar el plan", status: "pending", created_at: company.created_at,
      resolution: null as string | null, resolution_note: null as string | null, resolved_at: null as string | null,
    };
    const headers = { "access-control-allow-origin": "http://localhost:5184", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
    await page.route("http://localhost:3000/saas/platform/plan-change-requests**", async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (req.method() === "POST") {
        const body = req.postDataJSON() as { decision: string; note: string };
        expect(body.decision).toBe(decision);
        item.status = "closed";
        item.resolution = decision === "approve" ? "approved" : "rejected";
        item.resolution_note = body.note;
        item.resolved_at = company.created_at;
        return route.fulfill({ status: 201, json: { id: item.id }, headers });
      }
      const status = new URL(req.url()).searchParams.get("status");
      const items = !status || status === item.status ? [item] : [];
      return route.fulfill({ json: { items, total: items.length }, headers });
    });
    await page.goto("/platform/plan-change-requests");
    await expect(page.getByTestId("nav-plan-change-requests")).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Revisar solicitud" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Necesitamos activar el plan")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Ver organización" })).toHaveAttribute("href", "/platform/organizations/portal-org");
    if (decision === "reject") {
      await dialog.getByLabel("Decisión").selectOption("reject");
      await dialog.getByRole("button", { name: "Confirmar rechazo" }).click();
      await expect(dialog.getByText("Indica el motivo del rechazo para informar al cliente.")).toBeVisible();
      await dialog.getByLabel("Motivo del rechazo").fill("Debemos verificar la empresa");
    } else {
      await dialog.getByLabel("Respuesta al cliente (opcional)").fill("El plan está listo");
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("plan-review-mobile.png"), fullPage: true });
    await dialog.getByRole("button", { name: decision === "approve" ? "Aprobar y aplicar" : "Confirmar rechazo" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Sin solicitudes de cambio de plan")).toBeVisible();
    await page.getByLabel("Estado", { exact: true }).selectOption("closed");
    await expect(page.getByText(decision === "approve" ? "Aprobada" : "Rechazada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ver resultado" }).click();
    await expect(dialog.getByText(item.resolution_note ?? "")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Aprobar y aplicar" })).toHaveCount(0);
  });
}

test("company list shows a skeleton until data arrives", async ({ page }) => {
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await preparePortal(page, ownerPermissions, "org", { path: "/companies", wait });
  await page.goto("/app/companies");
  await expect(page.locator('[data-skeleton="table"]')).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Cargando empresas");
  release?.();
  await expect(page.getByText(company.legal_name, { exact: true })).toBeVisible();
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
});

test("owner initial audit errors do not leave a skeleton or show empty success", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await preparePortal(page, ownerPermissions, "platform", {
    path: "/saas/platform/audit-events",
    wait,
    fail: true,
  });
  await page.goto("/platform/audit");
  await expect(page.locator('[data-skeleton="table"]')).toBeVisible();
  release?.();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
});

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

test("TailAdmin desktop shell collapses, searches and switches theme", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePortal(page);
  await page.goto("/app/companies");
  const sidebar = page.locator("[data-admin-sidebar]");
  const content = page.locator("[data-admin-content]");
  await expect(sidebar).toHaveCSS("width", "290px");
  await expect(content).toHaveCSS("margin-left", "290px");
  await expect(page.getByTestId("nav-companies")).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: testInfo.outputPath("client-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Alternar menú lateral" }).click();
  await expect(sidebar).toHaveCSS("width", "90px");
  await expect(content).toHaveCSS("margin-left", "90px");
  await sidebar.hover();
  await expect(sidebar).toHaveCSS("width", "290px");
  await page.mouse.move(1000, 500);
  await expect(sidebar).toHaveCSS("width", "90px");
  await page.keyboard.press("Control+k");
  await page.getByRole("searchbox", { name: "Buscar una sección…" }).fill("API keys");
  await page
    .locator("[data-admin-header]")
    .getByRole("link", { name: "API keys", exact: true })
    .click();
  await expect(page).toHaveURL("/app/developers/api-keys");
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
});

test("TailAdmin drawer works below xl on tablet and mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await preparePortal(page);
  await page.goto("/app/companies");
  await expect(page.locator("[data-admin-content]")).toHaveCSS("margin-left", "0px");
  const toggle = page.getByRole("button", { name: "Alternar menú lateral" });
  await toggle.click();
  await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();
  await page.getByTestId("sidebar-backdrop").click({ position: { x: 900, y: 400 } });
  await expect(page.getByTestId("sidebar-backdrop")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.click();
  await page.getByTestId("nav-api-keys").click();
  await expect(page).toHaveURL("/app/developers/api-keys");
  await expect(page.getByTestId("sidebar-backdrop")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir acciones de cuenta" }).click();
  await expect(page.getByRole("button", { name: "Abrir menú de usuario" })).toBeVisible();
  await page.getByTestId("notif-bell").click();
  await expect(page.getByText("No tienes notificaciones.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar notificaciones" }).click();
  await expect
    .poll(() =>
      page
        .locator("[data-admin-sidebar]")
        .evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("client-mobile.png"), fullPage: true });
});

test("owner platform uses the shared shell with administrative routes", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePortal(page, ["platform:admin"], "platform");
  await page.goto("/platform/audit");
  await expect(page.locator("[data-admin-sidebar]")).toBeVisible();
  await expect(page.getByTestId("nav-audit")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("nav-organizations")).toBeVisible();
  await expect(page.getByTestId("nav-companies")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir menú de usuario" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("platform-desktop.png"), fullPage: true });
});

for (const limit of [0, 1]) {
  test('company creation is blocked by plan quota ' + limit + ' regardless of filters', async ({ page }) => {
    const writes = await preparePortal(page);
    await page.route('http://localhost:3000/organizations/me/plan', route => route.fulfill({
      headers: { 'access-control-allow-origin': 'http://localhost:5184' },
      json: { limits: { max_companies: limit }, usage: { companies: 1 } },
    }));
    await page.goto('/app/companies');
    const button = page.getByRole('button', { name: 'Crear empresa', exact: true });
    await expect(button).toBeDisabled();
    await expect(page.getByText('Alcanzaste el límite de tu plan: 1 de ' + limit + ' empresas.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar cambio de plan' })).toHaveAttribute('href', '/app/plan');
    await page.getByPlaceholder('Buscar RUC…').fill('99999999999');
    await expect(page.getByText('Sin empresas', { exact: true })).toBeVisible();
    await expect(button).toBeDisabled();
    expect(writes.filter(w => w.path === '/companies')).toHaveLength(0);
  });
}

test('company creation waits for quota and stays blocked when quota cannot load', async ({ page }) => {
  let release;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await preparePortal(page, ownerPermissions, 'org', { path: '/organizations/me/plan', wait, fail: true });
  await page.goto('/app/companies');
  await expect(page.getByText('Verificando el cupo de empresas…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear empresa', exact: true })).toBeDisabled();
  release?.();
  await expect(page.getByText('No se pudo verificar el cupo de empresas.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Crear empresa', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
});

test('company submission errors appear once in Sonner without a form alert', async ({ page }) => {
  await preparePortal(page);
  await page.route('http://localhost:3000/companies', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 400, headers: { 'access-control-allow-origin': 'http://localhost:5184' },
      json: { code: 'FACTOSYS_VALIDATION', message: 'Invalid RUC' } });
  });
  await page.goto('/app/companies');
  await page.getByRole('button', { name: 'Crear empresa', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('RUC', { exact: true }).fill('12345678912');
  await dialog.getByLabel('Razón social').fill('Prueba');
  await dialog.getByRole('button', { name: 'Crear', exact: true }).click();
  const message = 'El RUC ingresado no es válido. Revisa sus 11 dígitos.';
  await expect(page.locator('[data-sonner-toast]')).toContainText(message);
  await expect(page.getByText(message, { exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByLabel('Razón social')).toHaveValue('Prueba');
});

for (const platform of [false, true]) {
  test('users are created directly and can be managed in ' + (platform ? 'platform' : 'client'), async ({ page }) => {
    await preparePortal(page, platform ? ['platform:admin'] : [...ownerPermissions, 'users:read', 'users:write'], platform ? 'platform' : 'org');
    const base = platform ? '/saas/organizations/portal-org' : '/organizations/me';
    const members = [{ id: 'owner', name: 'Propietario', email: 'owner@factosysperu.com', roles: ['owner'], status: 'active', createdAt: company.created_at, lastLoginAt: null }];
    const headers = { 'access-control-allow-origin': 'http://localhost:5184', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
    await page.route('http://localhost:3000/**', async route => {
      const req = route.request(), pathname = new URL(req.url()).pathname;
      if (req.method() === 'OPTIONS') return route.fallback();
      const respond = (json: unknown, status = 200) => route.fulfill({ status, headers, json });
      if (pathname === '/saas/organizations/portal-org') return respond({ id: 'portal-org', name: 'Empresa API SAC', slug: 'empresa-api', status: 'active', is_platform: false, current_plan: null, created_at: company.created_at, updated_at: company.updated_at });
      if (pathname === '/saas/platform/plans') return respond({ items: [] });
      if (pathname === (platform ? base + '/plan-usage' : base + '/plan')) return respond({ limits: { max_users: 2 }, usage: { users: members.length } });
      if (pathname === base + '/roles') return respond([{ id: 'owner', code: 'owner', name: 'Propietario', permissions: [] }, { id: 'admin', code: 'admin', name: 'Administrador', permissions: [] }]);
      if (pathname === base + '/users') {
        if (req.method() === 'POST') {
          const body = req.postDataJSON();
          expect(body.invite).toBeUndefined(); expect(body.password).toBe('NewUserPass!2026');
          members.push({ ...body, id: 'member', status: 'active', createdAt: company.created_at, lastLoginAt: null });
          return respond(members[1], 201);
        }
        return respond(members);
      }
      if (pathname === base + '/users/member' && req.method() === 'PATCH') {
        const body = req.postDataJSON(); Object.assign(members[1], body); return respond(members[1]);
      }
      return route.fallback();
    });
    await page.goto(platform ? '/platform/organizations/portal-org' : '/app/users');
    await expect(page.getByText('§33')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Invitar usuario' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre', { exact: true }).fill('Nuevo usuario');
    await dialog.getByLabel('Correo electrónico', { exact: true }).fill('nuevo@factosysperu.com');
    await dialog.getByLabel('Contraseña', { exact: true }).fill('short');
    await dialog.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await expect(dialog.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible();
    await dialog.getByLabel('Contraseña', { exact: true }).fill('NewUserPass!2026');
    await dialog.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Crear usuario', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Editar usuario nuevo@factosysperu.com' }).click();
    await dialog.getByLabel('Nombre', { exact: true }).fill('Nombre actualizado');
    await dialog.getByLabel('Estado', { exact: true }).selectOption('disabled');
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Nombre actualizado', { exact: true })).toBeVisible();
    await expect(page.getByText('Desactivado', { exact: true })).toBeVisible();
  });
}

test('API key creation is disabled at quota in list and empty-state actions', async ({ page }) => {
  await preparePortal(page);
  await page.route('http://localhost:3000/organizations/me/plan', route => route.fulfill({ headers: { 'access-control-allow-origin': 'http://localhost:5184' }, json: { limits: { max_api_keys: 0 }, usage: { api_keys: 0 } } }));
  await page.goto('/app/developers/api-keys');
  await expect(page.getByRole('button', { name: 'Nueva API key' })).toHaveCount(2);
  for (const button of await page.getByRole('button', { name: 'Nueva API key' }).all()) await expect(button).toBeDisabled();
  await expect(page.getByText('Alcanzaste el límite de tu plan: 0 de 0 API keys.')).toBeVisible();
});
