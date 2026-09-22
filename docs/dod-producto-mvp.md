# DoD producto MVP (FE-314 / 03 §3)

Checklist operable para cerrar el MVP de producto: **API Fake + consola** (doc 03 §3 / §3.1).  
Sin secretos en este archivo.

Fuente normativa: [03-matriz-documentos-y-mvp.md](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/03-matriz-documentos-y-mvp.md) §3.

## Cómo verificar

```bash
docker compose up -d
pnpm db:migrate && pnpm db:seed
# terminal A
pnpm --filter @factosys/api start
# terminal B (tras build)
pnpm --filter @factosys/console preview
pnpm verify:dod
pnpm --filter @factosys/console test:e2e
```

| # | Capacidad 03 §3 | API Fake | Consola UI |
| --- | --- | --- | --- |
| 1 | Empresa + cert + SOL cifrados | `verify:dod` / `demo:api-mvp` | Empresas (tabs certificate / SOL) |
| 2 | Factura 01 → estado + XML + CDR | `verify:dod` + API e2e | Playwright `emit-invoice.spec.ts` |
| 3 | Boleta 03 + RC | API e2e (`app.e2e-spec.ts`) | Wizards boleta / RC |
| 4 | Notas 07/08 | API e2e | Wizards NC/ND |
| 5 | Baja RA | API e2e | Form RA |
| 6 | GRE 09 / 31 REST | API e2e | GRE lista + wizards |
| 7 | Validez CPE | `verify:dod` + API e2e | `/developers/validations` |
| 8 | Webhook de estado | `verify:dod` + API e2e | `/developers/webhooks` |
| 9 | PDF básico | `verify:dod` (magic `%PDF`) | Detalle → botones PDF |

## Evidencia automática

| Suite | Comando | Cubre |
| --- | --- | --- |
| API HTTP e2e | `pnpm --filter @factosys/api test:e2e` | 01/03/07/08/RA/RC/GRE/webhooks/PDF/CPE |
| Console Playwright | `pnpm --filter @factosys/console test:e2e` | RBAC owner/viewer + emit 01 → accepted |
| DoD script | `pnpm verify:dod` | health, ruleset, login, emit 01, xml/cdr/pdf, CPE, webhook |
| CI | `.github/workflows/ci.yml` | lint, build, migrate, seed, unit/e2e API, Playwright, verify:dod |

## Consola RBAC (§3.1)

- Sin permiso → ítem de menú **oculto** (no solo disabled).
- Viewer: sin `Emitir`, sin Users/API keys/Webhooks/Audit/Validations.
- Owner: acceso completo; deep-link a emit sin `documents:write` muestra error (sin CTA).

## Fuera de este DoD

- Homologación SUNAT beta live → [`checklist-sandbox-beta.md`](./checklist-sandbox-beta.md).
- SaaS comercial (S12+) → doc 34/35.
