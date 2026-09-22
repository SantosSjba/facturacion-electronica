# Facturación electrónica (Factosys)

Monorepo TypeScript para el backend de facturación electrónica SUNAT (CPE).  
Stack: **pnpm workspaces**, **TypeScript strict**, **ESLint flat + Prettier**, **Vitest**, **Turborepo**.

Documentación de producto y backlog: [planificacion-fe-SUNAT](https://github.com/SantosSjba/planificacion-fe-SUNAT)  
(en particular [23 — monorepo bootstrap](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/23-monorepo-bootstrap.md) y [32 — backlog](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/32-backlog-sprints-mvp.md)).

## Requisitos

| Tool    | Versión                                         |
| ------- | ----------------------------------------------- |
| Node.js | 20+ (ver `.nvmrc`)                              |
| pnpm    | 10.x (campo `packageManager` en `package.json`) |

```bash
pnpm install
```

## Scripts de contrato (root)

| Script                              | Descripción                                      |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm build`                        | Turbo: compila packages (`dist/`)                |
| `pnpm test`                         | Turbo: Vitest por package                        |
| `pnpm lint`                         | ESLint flat en el monorepo                       |
| `pnpm format` / `pnpm format:check` | Formatea / verifica con Prettier                 |
| `pnpm dev:api`                      | Stub — arranque de `apps/api` (pendiente S0-API) |
| `pnpm spike:sign`                   | Stub — spike firma XML (S1)                      |
| `pnpm spike:ubl`                    | Stub — spike constructor Invoice UBL (S1)        |
| `pnpm spike:sendbill`               | Stub — spike SendBill SOAP (S2)                  |

Los stubs `dev:api` y `spike:*` salen con código ≠ 0 hasta que existan las apps/runners reales.

## Estructura (S0)

```
apps/                 # apps Nest / FE (vacío hasta S0-API+)
packages/
  shared/             # @factosys/shared — primitives + smoke test
```

**Fuera de S0-TOOL:** lógica SUNAT, NestJS completo, Docker/CI (epics siguientes).

## Packages

| Package           | Nombre npm         | Rol                                          |
| ----------------- | ------------------ | -------------------------------------------- |
| `packages/shared` | `@factosys/shared` | Result/errors/logger types (scaffold mínimo) |

Importar siempre por nombre de workspace (`@factosys/shared`), no por path relativo entre packages.
