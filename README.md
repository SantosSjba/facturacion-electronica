# Facturación electrónica (Factosys)

Monorepo TypeScript para una API de facturación electrónica SUNAT (CPE), landing y paneles administrativos de dueño y cliente.

Alcance actual: [API y portales](docs/alcance-producto.md). La emisión se realiza mediante la API; un facturador visual queda para una etapa posterior.
Stack: **pnpm workspaces**, **NestJS 11**, **TypeScript strict**, **ESLint flat + Prettier**, **Vitest**, **Turborepo**, **Pino**, **Zod**.

Documentación de producto y backlog: [planificacion-fe-SUNAT](https://github.com/SantosSjba/planificacion-fe-SUNAT)

- [23 — monorepo bootstrap](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/23-monorepo-bootstrap.md)
- [24 — arquitectura Nest](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/24-arquitectura-nestjs.md)
- [32 — backlog sprints MVP](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/32-backlog-sprints-mvp.md)

## Desarrollo local

### Prerrequisitos

| Tool           | Versión                                         |
| -------------- | ----------------------------------------------- |
| Node.js        | 20+ (ver `.nvmrc`)                              |
| pnpm           | 10.x (campo `packageManager` en `package.json`) |
| Docker Desktop | Compose v2 (Postgres, Redis, MinIO)             |

### Arranque

```bash
pnpm install
cp .env.example .env

# Infra local (credenciales de desarrollo en compose — no usar en producción)
docker compose up -d
docker compose ps   # postgres :5433, redis :6379, minio :9000 / console :9001

pnpm db:migrate
pnpm db:seed

pnpm dev:api
# GET http://localhost:3000/health
# GET http://localhost:3000/ready  → database + redis "up"
# GET http://localhost:3000/docs   → OpenAPI facturación electrónica (/v1 + /meta)
# GET http://localhost:3000/docs-json → OpenAPI JSON (Scalar landing /docs)
# Demo login: owner@demo.local / DemoOwner!2026 (org slug: demo)

pnpm dev:saas-web
# http://localhost:5174 — Panel dueño y portal cliente (/platform /app /auth)

pnpm dev:landing
# http://localhost:4321 — marketing ES + guía #empezar
# http://localhost:4321/docs — Scalar API Reference (solo facturación vía /docs-json)
```

La API corre en el host con `pnpm dev:api` (sin contenedor Nest en S0).  
`DATABASE_URL` (Postgres **:5433**), `REDIS_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS` (landing `:4321`, saas-web `:5174`) y rate-limit en `.env.example`. Nest valida env; `/ready` hace ping a Postgres y Redis.

Verificación de API y portales: producto MVP [`docs/dod-producto-mvp.md`](docs/dod-producto-mvp.md) (`pnpm verify:dod`); SaaS comercial [`docs/dod-saas-comercial.md`](docs/dod-saas-comercial.md) (Playwright saas-web + export stub).

**SaaS** (prefijo `/saas`): `POST /saas/public/signup-requests` (landing), `GET /saas/plans` (catálogo público `active`), CRUD platform `POST/PATCH/DELETE /saas/plans` (DELETE = retire soft), `GET /saas/platform/plans` (admin incl. retirados), `GET/POST /saas/org-plans`, `GET/PATCH /saas/organizations` (tenants; suspender), `POST /saas/organizations/:id/exports` (S17-QA stub JSON async + download), `GET /saas/platform/stats` (KPIs), `GET /saas/platform/health`, `GET /saas/platform/audit-events` (S16-AUD; cross-tenant, redactado; filtros action/actor/dates/organization_id), `POST /saas/platform/impersonate` (S17-SEC; `platform:admin`; body `organization_id` + `reason` + `ttl_minutes` 1–60; access corto sin refresh; audit `support.impersonation.started`). **Auditoría UI**: saas-web `/platform/audit` (solo lectura). Eventos writer: `signup_request.approved`/`rejected`, `plan.assigned`, `legal.document.published`, `organization.suspended`/`reactivated`, `support.impersonation.started`. **Signup requests** (platform): `GET/PATCH /saas/signup-requests` — **approve** (`under_review` → `approved`) provisiona org + owner (`disabled`) + `org_plans` desde `plan_code` + invite email (`invite.owner`); **reject** exige `notes` y envía `signup.rejected`. **Auth**: `POST /auth/accept-invite` `{ token, password }` activa owner; `POST /auth/forgot-password` stub siempre 200 (anti-enumeración) + rate limit; UI saas-web `/auth/accept-invite`. Envs: `SAAS_WEB_PUBLIC_URL` (default `:5174`), `INVITE_TOKEN_TTL_HOURS`, `RATE_LIMIT_LOGIN_RPM` / `RATE_LIMIT_SIGNUP_RPM` / `RATE_LIMIT_FORGOT_RPM` (429 + `Retry-After` TTL real). **Onboarding** (org JWT): `GET /saas/onboarding/status` (`complete`, `has_company`, `requires_reaccept`), `GET /saas/onboarding/legal`, `POST /saas/onboarding/accept-legal` (evidencia IP/UA/`body_hash`) — sin empresa → saas-web gate `/app` → `/app/onboarding`; con empresa pero legal desactualizado → `requires_reaccept` + modal bloqueante en `/app/*` (sin redirigir al wizard). **Legal producto (S16-LEG)**: platform `POST /saas/legal/documents/:id/publish` (draft→published, body/hash inmutables; audit `legal.document.published`); accept audit `legal.accepted`; UI `/platform/legal` (list/create/edit markdown/publish). **Panel cliente `/app` (S15-APP)**: shell TailAdmin + nav (Inicio, Usuarios, Empresas, API keys, Webhooks, Plan, Notificaciones, Seguridad); banner rojo si JWT `imp` (suplantar); `GET /organizations/me/plan` (límites vs usage); `POST /organizations/me/users` con `invite:true` → email `invite.member`; configuración de empresas, certificados, SOL/GRE, series, API keys y webhooks desde `/app`; `POST /organizations/me/plan/change-requests` → ops `plan.change_requested` + in-app; inbox `GET/POST /organizations/me/notifications*` + prefs. **Notifications** (platform): `GET /saas/notifications`. Email: `EMAIL_DRIVER=log|resend|smtp`. Templates seed `signup.*` + `invite.owner` + `invite.member` + `plan.assigned` + `plan.change_requested`. Seeds planes `starter` / `growth` / `business`. **Legal**: `/saas/legal/documents` (platform) + published seed es-PE. **saas-web** (`:5174`): `/platform` (ops; Suplantar en detalle org) + `/app` (cliente post-onboarding); headers CSP/HSTS en Vite + ejemplo `apps/saas-web/nginx.headers.conf.example`; login `platform@factosys.local` / org `factosys-platform`. Landing: [Landwind](https://github.com/themesberg/landwind) + `@factosys/ui`.

### Contrato del monorepo

| Script                                            | Descripción                                                     |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm build`                                      | Turbo: compila todos los packages + API                         |
| `pnpm test`                                       | Turbo: Vitest unit + e2e API                                    |
| `pnpm lint`                                       | ESLint flat en el monorepo                                      |
| `pnpm format` / `pnpm format:check`               | Formatea / verifica con Prettier                                |
| `pnpm db:migrate` / `db:migrate:down` / `db:seed` | Postgres schema + seeds (`@factosys/db`)                        |
| `pnpm dev:api`                                    | Nest watch — `@factosys/api` (`start:dev`)                      |
| `pnpm dev:saas-web`                               | Vite — panel dueño y portal cliente                             |
| `pnpm dev:landing`                                | Astro — `landing` marketing + signup (S13)                      |
| `pnpm demo:api-mvp`                               | Demo Fake: ruleset → invoice → PDF (`scripts/demo-api-mvp.mjs`) |
| `pnpm spike:sign`                                 | Spike A — firma XML (`tmp/spikes/sign/`)                        |
| `pnpm spike:ubl`                                  | Spike B — Invoice UBL + firma B→A                               |
| `pnpm spike:sendbill`                             | Spike C — SendBill fake/beta (`tmp/spikes/sendbill/`)           |
| `pnpm sunat:unpack-schemas`                       | Unpack XSD UBL zip → `.cache/xsd-ubl/`                          |
| `pnpm sunat:unpack-xsl`                           | Unpack XSL 2.1 zip → `.cache/xsl-ubl-2.1/`                      |
| `pnpm validate:xml --type=01 …`                   | Gate XSD + Excel P0 (exit 1 on fail)                            |
| `pnpm validate:xsl --type=01 …`                   | Smoke XSL Factura (nightly warn)                                |

CI (GitHub Actions): unpack XSD → lint → test → build → `validate:xml --stages=xsd,excel` (Node 20).  
Nightly: `.github/workflows/xsl-nightly.yml` (`continue-on-error`).

## Estructura (S0 / S1 / S2)

```
apps/
  api/                  # @factosys/api — NestJS clean architecture
  saas-web/             # saas-web — Vite React SaaS skeleton (S12)
  landing/              # landing — Astro marketing (S12)
packages/
  shared/               # @factosys/shared — AppError, Result
  ui/                   # @factosys/ui — TailAdmin tokens + Button/Input/Shell (S12)
  domain/               # @factosys/domain — DocumentStatus, VOs
  sdk/                  # @factosys/sdk — cliente TS mínimo (S9)
  sunat-ubl/            # Spike B — Invoice UBL unsigned builder
  sunat-sign/           # Spike A — XMLDSig (xml-crypto)
  sunat-soap/           # Spike C — SendBill (Fake + SOAP UsernameToken)
  sunat-validation/     # S1-GATE XSD + S2-VAL Excel P0 (+ XSL nightly)
  sunat-catalogs/       # S2-VAL — JSON catalogs
  sunat-gre/            # stub — GRE REST
  pdf-ri/               # stub — PDF RI
  db/                   # @factosys/db — Drizzle schema + migrations + seeds
docker-compose.yml      # Postgres 16 (:5433), Redis 7, MinIO (S0-DEV)
.github/workflows/ci.yml
.github/workflows/xsl-nightly.yml
```

**S0 disponible:** tooling, API skeleton, packages stub, Docker/CI.  
**S1 disponible:** firma + UBL + gate XSD.  
**S2 disponible:** SendBill Spike C + catálogos + Excel P0 (CI block) + XSL nightly warn.  
**Pendiente de madurez:** validación con servicios SUNAT reales, recuperación ante fallos y preparación para producción. La emisión manual desde un facturador visual queda fuera del alcance actual.

## Packages / apps

| Path                        | Nombre npm                   | Rol                                   |
| --------------------------- | ---------------------------- | ------------------------------------- |
| `apps/api`                  | `@factosys/api`              | HTTP API NestJS                       |
| `apps/saas-web`             | `saas-web`                   | Panel dueño y portal cliente          |
| `apps/landing`              | `landing`                    | Marketing Astro ES + Scalar `/docs`   |
| `packages/shared`           | `@factosys/shared`           | `AppError`, `AppErrorCode`, `Result`  |
| `packages/ui`               | `@factosys/ui`               | Tokens TailAdmin + Button/Input/Shell |
| `packages/domain`           | `@factosys/domain`           | `DocumentStatus`, VOs (sin Nest)      |
| `packages/sunat-ubl`        | `@factosys/sunat-ubl`        | Builder Invoice UBL unsigned          |
| `packages/sunat-sign`       | `@factosys/sunat-sign`       | Firma XMLDSig (`SignXmlPort`)         |
| `packages/sunat-soap`       | `@factosys/sunat-soap`       | SendBill (`BillServicePort`)          |
| `packages/sunat-validation` | `@factosys/sunat-validation` | Gate XSD + Excel P0                   |
| `packages/sunat-catalogs`   | `@factosys/sunat-catalogs`   | Catálogos JSON (`CatalogPort`)        |
| `packages/sunat-gre`        | `@factosys/sunat-gre`        | Stub GRE                              |
| `packages/pdf-ri`           | `@factosys/pdf-ri`           | RI PDF Fake/Playwright (S8)           |
| `packages/sdk`              | `@factosys/sdk`              | Cliente TS mínimo (S9)                |

Checklist sandbox/beta: [`docs/checklist-sandbox-beta.md`](docs/checklist-sandbox-beta.md).

Importar siempre por nombre de workspace (`@factosys/...`), no por path relativo entre packages.
