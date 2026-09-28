# DoD SaaS comercial (FE-487 / doc 34 §9)

Checklist operable para cerrar el **producto SaaS comercial** (S12–S17): landing →
platform → onboarding → panel cliente → seguridad → calidad.

Complementa el DoD MVP (API Fake + console): [`dod-producto-mvp.md`](./dod-producto-mvp.md).

Fuente normativa: planificacion doc **34 §9** + sprint S17 (FE-467).

## Cómo verificar

```bash
docker compose up -d
pnpm db:migrate && pnpm db:seed
# terminal A
pnpm --filter @factosys/api start
# terminal B (tras build)
pnpm --filter saas-web preview
pnpm --filter saas-web test:e2e
pnpm --filter @factosys/api test:e2e
pnpm build
```

| # | Capacidad comercial | Evidencia |
| --- | --- | --- |
| 1 | Landing signup público | API e2e `POST /saas/public/signup-requests`; landing form |
| 2 | Platform login + panel | Playwright `platform-login.spec.ts`; seed `platform@factosys.local` |
| 3 | Approve / reject signup | Playwright `signup-approve.spec.ts`; API e2e signup platform |
| 4 | Invite owner + accept-invite | Playwright `onboard.spec.ts`; API e2e invite.owner |
| 5 | Onboarding empresa + legal | Playwright onboard; `GET/POST /saas/onboarding/*` |
| 6 | Legal publish + re-accept gate | Playwright `legal-gate.spec.ts`; S16-LEG API e2e |
| 7 | Panel cliente `/app` | S15-APP UI (usuarios, empresas, plan, notifs, seguridad) |
| 8 | Rate limits login/signup/forgot + Retry-After | S17-SEC API e2e abuse |
| 9 | Impersonate platform:admin + banner | S17-SEC API e2e + saas-web UI |
| 10 | Export org JSON stub (async ticket) | API e2e S17-QA export; UI botón detalle org |
| 11 | Cross-tenant fail-closed | S17-SEC e2e 404/403 |
| 12 | CSP/HSTS saas-web | `vite.config.ts` + `nginx.headers.conf.example` |

## Evidencia automática

| Suite | Comando | Cubre |
| --- | --- | --- |
| API HTTP e2e | `pnpm --filter @factosys/api test:e2e` | SaaS signup/legal/platform/SEC/export |
| saas-web Playwright | `pnpm --filter saas-web test:e2e` | Login plat, approve, onboard, legal gate |
| Console Playwright | `pnpm --filter @factosys/console test:e2e` | Emit MVP (fuera de §9 SaaS, sigue DoD producto) |
| CI | `.github/workflows/ci.yml` | build, migrate, API e2e, console + saas-web Playwright |

## Sign-off (FE-488)

| Campo | Valor |
| --- | --- |
| Epic | FE-467 S17-QA |
| Fecha | 2026-09-27 |
| Owner | Factosys engineering |
| Checklist | Todo checked (filas 1–12 arriba implementadas y verificables por CI/comandos) |

**Cierre comercial S17:** límites de tasa (S17-SEC), E2E Playwright (S17-QA-01), export stub (S17-QA-02), DoD §9 documentado (S17-QA-03).
