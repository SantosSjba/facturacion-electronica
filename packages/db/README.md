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
- Owner user `cliente@factosysperu.com` / `DemoOwner!2026` (dev only)
- Platform organization `factosys-platform`, superadmin `platform@factosysperu.com` / `PlatformAdmin!2026`
- One initial plan: `starter`
- Development legal placeholders and notification templates required by onboarding

No companies, documents, certificates, API keys, requests or extra users are created.
Scripts automatically build the package and load the root `.env`. Public development
credentials are restricted to the local Compose database (`localhost:5433/factosys`), never production.

`pnpm db:reset` deletes all local application data and recreates this minimal seed
in one transaction. Migration history is preserved. Existing sessions become invalid;
log in again with the credentials above. `pnpm db:seed` only adds missing seed entries
and does not reset existing passwords or remove old data.

## Scripts (root)

| Script | Purpose |
| --- | --- |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:migrate:down` | Roll back latest (`-- --all` for full) |
| `pnpm db:seed` | Idempotent demo org + RBAC + catalog_versions |
| `pnpm db:reset` | Clear local data and recreate the minimal seed (destructive) |
| `pnpm db:generate` | drizzle-kit generate (optional; SQL is hand-maintained for up/down) |

## Scope

Core tables (`organizations` … `audit_events`) + RBAC (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`).
