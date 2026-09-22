# `@factosys/api`

NestJS HTTP API for Factosys electronic invoicing. **No SUNAT business logic in S0.**

## Clean architecture layers

| Layer          | Path                   | Responsibility                                        |
| -------------- | ---------------------- | ----------------------------------------------------- |
| Interfaces     | `src/interfaces/http/` | Controllers, DTOs, middleware, filters (Nest OK)      |
| Application    | `src/application/`     | Use cases / application services (**no `@nestjs/*`**) |
| Infrastructure | `src/infrastructure/`  | Adapters: config, DB, SOAP, queues (Nest modules OK)  |

### Hard rules

1. `src/application/**` must not import `@nestjs/*`.
2. Future `packages/domain/**` must not import `@nestjs/*` (or TypeORM).
3. Controllers live only under `interfaces/http`.
4. Domain/application talk to the outside world through ports; adapters sit in `infrastructure`.

ESLint enforces (1) and (2) via `no-restricted-imports`.

## Scripts

| Script                                  | Description            |
| --------------------------------------- | ---------------------- |
| `pnpm --filter @factosys/api start:dev` | Watch mode             |
| `pnpm --filter @factosys/api build`     | `nest build`           |
| `pnpm --filter @factosys/api test`      | Unit/smoke Vitest      |
| `pnpm --filter @factosys/api test:e2e`  | E2E Vitest + supertest |

Root shortcut: `pnpm dev:api`.
