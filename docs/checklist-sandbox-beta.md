# Checklist sandbox / beta live (S9-06)

Lista operable para ops e integradores. **Sin secretos** — no pegar SOL, PFX ni API keys aquí.

Fuente de producto: [22-sandbox-setup](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/22-sandbox-setup.md).

## Modos

| Modo | Env | Uso |
| --- | --- | --- |
| `local-rules` / Fake | `SUNAT_BILL_MODE=fake`, `SUNAT_GRE_MODE=fake`, `SUNAT_VALIDEZ_MODE=fake`, `PDF_RI_MODE=fake` | CI, onboarding, `pnpm demo:api-mvp` |
| `mock-cdr` | Igual Fake (CDR sintético en `@factosys/sunat-soap`) | Demos / SDK |
| `sunat-beta` | `SUNAT_BILL_MODE=beta` (+ GRE/validez beta) | RUC prueba + .pfx + SOL reales |

## Infra local

- [ ] `docker compose up -d` → Postgres `:5433`, Redis `:6379`, MinIO `:9000`
- [ ] `pnpm db:migrate && pnpm db:seed`
- [ ] `pnpm dev:api` → `GET /health` y `GET /ready` OK
- [ ] `GET /meta/ruleset` → `ruleset_version: 2026-08-26`

## Onboarding company (JWT consola)

1. [ ] Login demo (`owner@demo.local` / seed) o usuario org
2. [ ] `POST /companies` (sandbox)
3. [ ] `PUT …/certificate` (PFX + password)
4. [ ] `PUT …/sol-credentials`
5. [ ] (Opcional GRE) `PUT …/gre-credentials`
6. [ ] Series: `F001` (01), `B001` (03), notas, `T001`/`V001` si GRE
7. [ ] API key con scopes `documents:*`, `webhooks:manage`, `validations:cpe` según necesidad

## Verificación Fake (DoD API)

- [ ] Emitir factura 01 → status `accepted` / `accepted_with_observation`
- [ ] `GET /v1/documents/{id}/xml` y `/cdr`
- [ ] `GET /v1/documents/{id}/pdf` → magic `%PDF`
- [ ] Webhook create + delivery firmada (HMAC ADR-004) en test/local
- [ ] `POST /v1/validations/cpe` → Fake + segundo call `cached: true`
- [ ] Errores: códigos `FACTOSYS_*` estables (matriz e2e S9-02)

## Beta live (cuando haya RUC)

- [ ] RUC(s) de prueba asignados
- [ ] URLs WSDL/REST según [sunat-endpoints](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/artifacts/sunat-endpoints.md)
- [ ] `SUNAT_BILL_MODE=beta` + credenciales SOL de la company
- [ ] Emitir fixture `01-invoice-gravada` y comparar CDR real
- [ ] (GRE) OAuth + envío 09/31 en beta
- [ ] No commitear secretos; rotar si se filtraron

## Demo rápida

```bash
docker compose up -d
pnpm db:migrate && pnpm db:seed
pnpm --filter @factosys/api start   # otra terminal
pnpm demo:api-mvp
```

## Observabilidad

- [ ] `OTEL_ENABLED=0` (default) — emit sin exporter
- [ ] `OTEL_ENABLED=1` — spans Console; o `OTEL_EXPORTER_OTLP_ENDPOINT` para OTLP HTTP
