# `@factosys/db`

Postgres schema + Drizzle client for Factosys (doc 26, S3-DB).

## Setup

```bash
docker compose up -d postgres
export DATABASE_URL=postgresql://factosys:factosys@localhost:5433/factosys
pnpm db:migrate
pnpm db:seed
```

## Scripts (root)

| Script | Purpose |
| --- | --- |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:migrate:down` | Roll back latest (`--all` for full) |
| `pnpm db:seed` | Idempotent demo org + catalog_versions `2026-08-26` |
| `pnpm db:generate` | drizzle-kit generate (optional; SQL is hand-maintained for up/down) |

## Scope

Core tables (`organizations` … `audit_events`). RBAC (`users`/`roles`) is S3-AUTH.
