# Factosys Console (`@factosys/console`)

Ops console for electronic invoicing (Sprint 10 — S10-APP).

**UI base:** [shadcn-admin](https://github.com/satnaing/shadcn-admin) patterns (MIT) + [shadcn/ui](https://ui.shadcn.com) primitives. Auth is Factosys JWT (not Clerk).

## Dev

```bash
# API + seed (postgres/redis)
pnpm dev:api

# Console (http://localhost:5173)
pnpm dev:console
```

Demo login (after `pnpm db:seed`):

- Organización: `demo`
- Email: `owner@demo.local`
- Password: `DemoOwner!2026`

Env:

| Variable | Default |
| --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000` |
| `VITE_DEFAULT_ORG_SLUG` | `demo` |

## Modules

`auth`, `companies`, `documents`, `gre`, `developers`, `users` + `shared/ui` (tokens, Empty/Error/Loading).
