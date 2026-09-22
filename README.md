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
| `pnpm spike:sign`                   | Stub — spike firma XML (S1)                |
| `pnpm spike:ubl`                    | Stub — spike constructor Invoice UBL (S1)  |
| `pnpm spike:sendbill`               | Stub — spike SendBill SOAP (S2)            |

CI (GitHub Actions): en push/PR a `main` ejecuta `pnpm lint` → `pnpm test` → `pnpm build` (Node 20 + cache pnpm).

## Estructura (S0)

```
apps/
  api/                  # @factosys/api — NestJS clean architecture
packages/
  shared/               # @factosys/shared — AppError, Result
  domain/               # @factosys/domain — DocumentStatus, VOs
  sunat-ubl/            # stub — UBL builders
  sunat-sign/           # stub — XML signature
  sunat-soap/           # stub — billService SOAP
  sunat-validation/     # stub — XSD / rules
  sunat-catalogs/       # stub — catalogs
  sunat-gre/            # stub — GRE REST
  pdf-ri/               # stub — PDF RI
docker-compose.yml      # Postgres 16, Redis 7, MinIO (S0-DEV)
.github/workflows/ci.yml
```

**S0 disponible:** tooling (S0-TOOL), API skeleton (S0-API), packages stub (S0-PKG), Docker/CI/higiene (S0-DEV).  
**Fuera de S0:** lógica SUNAT real, wiring Nest→Postgres/Redis/MinIO, imagen Docker de la API.

## Packages / apps

| Path                        | Nombre npm                   | Rol                                  |
| --------------------------- | ---------------------------- | ------------------------------------ |
| `apps/api`                  | `@factosys/api`              | HTTP API NestJS                      |
| `packages/shared`           | `@factosys/shared`           | `AppError`, `AppErrorCode`, `Result` |
| `packages/domain`           | `@factosys/domain`           | `DocumentStatus`, VOs (sin Nest)     |
| `packages/sunat-ubl`        | `@factosys/sunat-ubl`        | Stub UBL builders                    |
| `packages/sunat-sign`       | `@factosys/sunat-sign`       | Stub firma XML                       |
| `packages/sunat-soap`       | `@factosys/sunat-soap`       | Stub SOAP                            |
| `packages/sunat-validation` | `@factosys/sunat-validation` | Stub validación XSD                  |
| `packages/sunat-catalogs`   | `@factosys/sunat-catalogs`   | Stub catálogos                       |
| `packages/sunat-gre`        | `@factosys/sunat-gre`        | Stub GRE                             |
| `packages/pdf-ri`           | `@factosys/pdf-ri`           | Stub PDF RI                          |

Importar siempre por nombre de workspace (`@factosys/...`), no por path relativo entre packages.
