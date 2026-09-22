# Facturación electrónica (Factosys)

Monorepo TypeScript para el backend de facturación electrónica SUNAT (CPE).  
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
# GET http://localhost:3000/docs   → OpenAPI (non-production)
# Demo login: owner@demo.local / DemoOwner!2026 (org slug: demo)
```

La API corre en el host con `pnpm dev:api` (sin contenedor Nest en S0).  
`DATABASE_URL` (Postgres **:5433**), `REDIS_URL`, `JWT_ACCESS_SECRET` y rate-limit en `.env.example`. Nest valida env; `/ready` hace ping a Postgres y Redis.

### Contrato del monorepo

| Script                              | Descripción                                |
| ----------------------------------- | ------------------------------------------ |
| `pnpm build`                        | Turbo: compila todos los packages + API    |
| `pnpm test`                         | Turbo: Vitest unit + e2e API               |
| `pnpm lint`                         | ESLint flat en el monorepo                 |
| `pnpm format` / `pnpm format:check` | Formatea / verifica con Prettier           |
| `pnpm db:migrate` / `db:migrate:down` / `db:seed` | Postgres schema + seeds (`@factosys/db`) |
| `pnpm dev:api`                      | Nest watch — `@factosys/api` (`start:dev`) |
| `pnpm demo:api-mvp`                 | Demo Fake: ruleset → invoice → PDF (`scripts/demo-api-mvp.mjs`) |
| `pnpm spike:sign`                   | Spike A — firma XML (`tmp/spikes/sign/`)   |
| `pnpm spike:ubl`                    | Spike B — Invoice UBL + firma B→A          |
| `pnpm spike:sendbill`               | Spike C — SendBill fake/beta (`tmp/spikes/sendbill/`) |
| `pnpm sunat:unpack-schemas`         | Unpack XSD UBL zip → `.cache/xsd-ubl/`     |
| `pnpm sunat:unpack-xsl`             | Unpack XSL 2.1 zip → `.cache/xsl-ubl-2.1/` |
| `pnpm validate:xml --type=01 …`     | Gate XSD + Excel P0 (exit 1 on fail)       |
| `pnpm validate:xsl --type=01 …`     | Smoke XSL Factura (nightly warn)           |

CI (GitHub Actions): unpack XSD → lint → test → build → `validate:xml --stages=xsd,excel` (Node 20).  
Nightly: `.github/workflows/xsl-nightly.yml` (`continue-on-error`).

## Estructura (S0 / S1 / S2)

```
apps/
  api/                  # @factosys/api — NestJS clean architecture
packages/
  shared/               # @factosys/shared — AppError, Result
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
**Fuera de alcance aún:** Nest wiring, Postgres (S3), XSL blocking.

## Packages / apps

| Path                        | Nombre npm                   | Rol                                  |
| --------------------------- | ---------------------------- | ------------------------------------ |
| `apps/api`                  | `@factosys/api`              | HTTP API NestJS                      |
| `packages/shared`           | `@factosys/shared`           | `AppError`, `AppErrorCode`, `Result` |
| `packages/domain`           | `@factosys/domain`           | `DocumentStatus`, VOs (sin Nest)     |
| `packages/sunat-ubl`        | `@factosys/sunat-ubl`        | Builder Invoice UBL unsigned         |
| `packages/sunat-sign`       | `@factosys/sunat-sign`       | Firma XMLDSig (`SignXmlPort`)        |
| `packages/sunat-soap`       | `@factosys/sunat-soap`       | SendBill (`BillServicePort`)         |
| `packages/sunat-validation` | `@factosys/sunat-validation` | Gate XSD + Excel P0                  |
| `packages/sunat-catalogs`   | `@factosys/sunat-catalogs`   | Catálogos JSON (`CatalogPort`)       |
| `packages/sunat-gre`        | `@factosys/sunat-gre`        | Stub GRE                             |
| `packages/pdf-ri`           | `@factosys/pdf-ri`           | RI PDF Fake/Playwright (S8)          |
| `packages/sdk`              | `@factosys/sdk`              | Cliente TS mínimo (S9)               |

Checklist sandbox/beta: [`docs/checklist-sandbox-beta.md`](docs/checklist-sandbox-beta.md).

Importar siempre por nombre de workspace (`@factosys/...`), no por path relativo entre packages.
