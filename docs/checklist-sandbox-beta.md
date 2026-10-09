# Checklist sandbox / beta live (S9-06)

Lista operable para ops e integradores. **Sin secretos** — no pegar SOL, PFX ni API keys aquí.

Fuente de producto: [22-sandbox-setup](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/22-sandbox-setup.md).

## Modos

| Modo                 | Env                                                                                          | Uso                                 |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| `local-rules` / Fake | `SUNAT_BILL_MODE=fake`, `SUNAT_GRE_MODE=fake`, `SUNAT_VALIDEZ_MODE=fake`, `PDF_RI_MODE=fake` | CI, onboarding, `pnpm demo:api-mvp` |
| `mock-cdr`           | Igual Fake (CDR sintético en `@factosys/sunat-soap`)                                         | Demos / SDK                         |
| `sunat-beta`         | `SUNAT_BILL_MODE=beta` (+ GRE/validez beta)                                                  | RUC prueba + .pfx + SOL reales      |

## Infra local

- [ ] `docker compose up -d` → Postgres `:5433`, Redis `:6379`, MinIO `:9000`
- [ ] `pnpm db:migrate && pnpm db:seed`
- [ ] `pnpm dev:api` → `GET /health` y `GET /ready` OK
- [ ] `GET /meta/ruleset` → `ruleset_version: 2026-08-26`

## Onboarding company (JWT panel cliente)

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

## Salida a producción — fases 0 a 4

Estas casillas requieren ejecución en el ambiente indicado. Las pruebas con Fake no completan aceptación oficial.

| Evidencia local (2026-10-08)      | Resultado                                 | Límite                                                                      |
| --------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| API unitarias                     | 100 aprobadas                             | Servicios locales/mocks                                                     |
| Suites aisladas fiscal 0–4 y logo | 33 aprobadas (13 de Fase 4)               | Postgres/MinIO locales y transporte Fake/controlado                         |
| SOAP / SDK                        | 21 / 11 aprobadas                         | Contrato probado sin SUNAT real                                             |
| Ejemplos JSON                     | 26 pasan schemas estrictos                | No emiten ni consultan SUNAT                                                |
| Suite heredada app.e2e            | 16 fallos en organización demo compartida | Cuotas llenas, rate limit y fixtures GRE antiguos; requiere fixture aislado |
| SUNAT oficial y correo real       | Pendientes                                | Requieren certificado/credenciales/proveedor                                |

- [ ] Migración 0017 aplicada en el despliegue; Postgres/Redis/MinIO privados y worker `document-delivery` operativo.
- [ ] API keys por organización y ambiente con scopes mínimos; recursos de otra empresa/organización bloqueados; 401/403/404 verificados.
- [ ] Certificado válido para el emisor, SOL y OAuth GRE; secretos cifrados, master key protegida, rotación y revocación comprobadas. No usar PFX generado por los tests.
- [ ] Emisión real: contado/crédito/cuotas, PEN/USD/tipo de cambio, impuestos mixtos/gratuitos, descuentos/cargos, anticipos, detracción, ICBPER/ISC/IVAP y exportación con datos válidos.
- [ ] Actualizar catálogo XSL para anticipos con ISC; conservar XML firmado y resultado XSD/XSL por caso.
- [ ] Notas por devolución/descuento/cuotas y débito contra documento real; comprobar importes y referencia.
- [ ] Boleta en RC y baja CPE por RA/RC: ticket, CDR y relación con documento original; anulación separada de cobranza.
- [ ] GRE 09 público/privado, M1/L y 31 con secundarios/subcontratación/aduanas: CDR oficial, QR oficial leído y PDF definitivo. No usar RA/RC como baja GRE.
- [ ] Recuperar CDR de factura/notas F en producción y RC/RA por ticket: identidad y RUC correctos, sin nuevo XML/correlativo; registrar consultas fallidas, límites y conciliación de documentos previamente registrados.
- [ ] Consulta/listado/trace y descargas XML/CDR/PDF/QR coinciden con el resultado SUNAT; logo histórico no cambia después de rotarlo.
- [ ] SMTP/Resend real: remitente verificado, SPF/DKIM/DMARC, adjuntos en buzón propio, varios destinatarios, reintento seguro e incierto `unknown` sin repetición automática. `sent` no acredita lectura.
- [ ] Outbox tras caída del worker/Redis: preparación recuperable; envío incierto requiere revisión autorizada; nunca alterar estado fiscal por error de email.
- [ ] Enlaces bajo HTTPS: restricciones de artefactos, vencimiento y revocación efectivos, sin API key ni datos del cliente en metadata. Proxy/logs no almacenan token, ni cachean descarga privada.
- [ ] Webhook real: firma HMAC validada, eventos deduplicados, respuesta rápida y procesamiento independiente; respaldos/restauración de DB y MinIO verificados.
- [ ] Guardar evidencia sin secretos: fecha/ambiente/tipo/serie-número, request_id, hashes XML/CDR/PDF, código SUNAT, lectura de QR y resultado de entrega; separar Fake, beta y producción.

Contrato y ejemplos: [Fase 4](phase4-integration.md), [guía integradores](integracion/README.md). La implementación local está terminada; el pase oficial requiere completar las casillas externas.
