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
docker compose ps   # postgres :5432, redis :6379, minio :9000 / console :9001

pnpm dev:api
# GET http://localhost:3000/health
# GET http://localhost:3000/ready
```

La API corre en el host con `pnpm dev:api` (sin contenedor Nest en S0).  
`DATABASE_URL`, `REDIS_URL` y `MINIO_*` en `.env.example` apuntan al compose; Nest aún no los consume (wiring en sprints posteriores).

### Contrato del monorepo

| Script                              | Descripción                                |
| ----------------------------------- | ------------------------------------------ |
| `pnpm build`                        | Turbo: compila todos los packages + API    |
| `pnpm test`                         | Turbo: Vitest unit + e2e API               |
| `pnpm lint`                         | ESLint flat en el monorepo                 |
| `pnpm format` / `pnpm format:check` | Formatea / verifica con Prettier           |
| `pnpm dev:api`                      | Nest watch — `@factosys/api` (`start:dev`) |
| `pnpm spike:sign`                   | Spike A — firma XML (`tmp/spikes/sign/`)   |
| `pnpm spike:ubl`                    | Spike B — Invoice UBL + firma B→A          |
| `pnpm spike:sendbill`               | Spike C — SendBill fake/beta (`tmp/spikes/sendbill/`) |
| `pnpm sunat:unpack-schemas`         | Unpack XSD UBL zip → `.cache/xsd-ubl/`     |
| `pnpm validate:xml --type=01 <xml>` | Gate XSD Invoice (exit 1 on fail)          |

CI (GitHub Actions): unpack XSD (cache por hash del zip) → `pnpm lint` → `pnpm test` → `pnpm build` → `pnpm validate:xml` sobre golden Invoice (Node 20 + cache pnpm).

## Estructura (S0 / S1 / S2 parcial)

```
apps/
  api/                  # @factosys/api — NestJS clean architecture
packages/
  shared/               # @factosys/shared — AppError, Result
  domain/               # @factosys/domain — DocumentStatus, VOs
  sunat-ubl/            # Spike B — Invoice UBL unsigned builder
  sunat-sign/           # Spike A — XMLDSig (xml-crypto)
  sunat-soap/           # Spike C — SendBill (Fake + SOAP UsernameToken)
  sunat-validation/     # S1-GATE — XSD via xmllint-wasm
  sunat-catalogs/       # stub — catalogs
  sunat-gre/            # stub — GRE REST
  pdf-ri/               # stub — PDF RI
docker-compose.yml      # Postgres 16, Redis 7, MinIO (S0-DEV)
.github/workflows/ci.yml
```

**S0 disponible:** tooling (S0-TOOL), API skeleton (S0-API), packages stub (S0-PKG), Docker/CI/higiene (S0-DEV).  
**S1 disponible:** firma XML (S1-SIGN) + constructor Invoice UBL (S1-UBL) + gate XSD CI (S1-GATE).  
**S2 disponible (parcial):** SendBill Spike C (S2-SOAP) — `pnpm spike:sendbill` (fake por defecto; beta con SOL).  
**Fuera de alcance aún:** Excel P0 / XSL nightly (S2-VAL), wiring Nest→infra, Postgres (S3).

## Packages / apps

| Path                        | Nombre npm                   | Rol                                  |
| --------------------------- | ---------------------------- | ------------------------------------ |
| `apps/api`                  | `@factosys/api`              | HTTP API NestJS                      |
| `packages/shared`           | `@factosys/shared`           | `AppError`, `AppErrorCode`, `Result` |
| `packages/domain`           | `@factosys/domain`           | `DocumentStatus`, VOs (sin Nest)     |
| `packages/sunat-ubl`        | `@factosys/sunat-ubl`        | Builder Invoice UBL unsigned         |
| `packages/sunat-sign`       | `@factosys/sunat-sign`       | Firma XMLDSig (`SignXmlPort`)        |
| `packages/sunat-soap`       | `@factosys/sunat-soap`       | SendBill (`BillServicePort`)         |
| `packages/sunat-validation` | `@factosys/sunat-validation` | Gate XSD (`SunatValidationPort`)     |
| `packages/sunat-catalogs`   | `@factosys/sunat-catalogs`   | Stub catálogos                       |
| `packages/sunat-gre`        | `@factosys/sunat-gre`        | Stub GRE                             |
| `packages/pdf-ri`           | `@factosys/pdf-ri`           | Stub PDF RI                          |

Importar siempre por nombre de workspace (`@factosys/...`), no por path relativo entre packages.
