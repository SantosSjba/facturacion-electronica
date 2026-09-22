# `@factosys/db`

Postgres schema + Drizzle client for Factosys (doc 26, S3-DB / S3-AUTH).

## Setup

```bash
docker compose up -d postgres
export DATABASE_URL=postgresql://factosys:factosys@localhost:5433/factosys
pnpm db:migrate
pnpm db:seed
```

Demo seed includes:

- Organization `demo`
- Catalog ruleset `2026-08-26`
- RBAC roles/permissions matrix (doc 33)
- Owner user `owner@demo.local` / `DemoOwner!2026` (dev only)
- Viewer user `viewer@demo.local` / `DemoViewer!2026` (dev only)

## Scripts (root)

| Script | Purpose |
| --- | --- |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:migrate:down` | Roll back latest (`-- --all` for full) |
| `pnpm db:seed` | Idempotent demo org + RBAC + catalog_versions |
| `pnpm db:generate` | drizzle-kit generate (optional; SQL is hand-maintained for up/down) |

## Scope

Core tables (`organizations` … `audit_events`) + RBAC (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`).
