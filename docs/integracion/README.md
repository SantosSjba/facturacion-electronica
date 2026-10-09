# Integración Factosys

Primero consultar `GET /v1/capabilities` y OpenAPI `/docs`; crear una API key de la organización con los scopes necesarios. Configurar `FACTOSYS_URL`, `FACTOSYS_API_KEY`, `FACTOSYS_COMPANY_ID` y una `FACTOSYS_IDEMPOTENCY_KEY` persistida por operación. Usar sandbox y destinatarios propios para pruebas.

## Capacidades

| Capacidad                                                                      | Disponibilidad         | Evidencia                                                    |
| ------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------ |
| Factura, boleta, notas, RC/RA                                                  | Implementada           | Fases 0–2, pruebas locales                                   |
| Crédito/cuotas, ajustes, anticipos, detracción, ICBPER, ISC, IVAP, exportación | Implementada           | Fase 1; anticipo ISC pendiente catálogo XSL actualizado      |
| GRE remitente/transportista avanzada, PDF/QR                                   | Implementada           | Fase 3; definitivo requiere CDR/QR oficial                   |
| Consulta detallada, filtro serie/número, observaciones y archivos              | Implementada           | Fase 4                                                       |
| Recuperación CDR factura/notas F                                               | Producción; Fake local | Servicio oficial getStatusCdr; aceptación real pendiente     |
| Reconciliar RC/RA/GRE                                                          | Ticket existente       | Reintentos acotados, sin reemisión                           |
| Correo multirreceptor y seguimiento                                            | Implementado           | Cola/outbox; proveedor real pendiente                        |
| Acceso temporal revocable                                                      | Implementado           | Token por documento/archivo; MinIO privado                   |
| Empresas/series/certificados/SOL/OAuth/logo por API                            | Implementado           | Scopes, organización, ambiente, cifrado y auditoría          |
| Retención/percepción electrónicas independientes y reversión                   | No habilitado          | Fase 5                                                       |
| Factosys TXT v1 (01/03/07/08)                                                  | Implementado           | Fase 6; mismo motor e idempotencia JSON                      |
| Contingencia física, nuevas extensiones sectoriales, offline/reseller          | No habilitado          | Fase 6; diseño separado y demanda pendiente                  |
| Baja GRE mediante RA/RC                                                        | No habilitado          | No prometer una operación oficial inexistente en el contrato |

Implementado no significa homologado ni aceptado oficialmente. Ver [contrato completo Fase 4](../phase4-integration.md).

## Ejemplos

- [cURL](curl.sh): consulta, emisión, entrega, recuperación y certificado multipart. En Windows usar `curl.exe`; adaptar variables del shell.
- [TypeScript](example.ts): SDK `@factosys/sdk`, emisión y espera acotada, entrega opcional y enlace PDF.
- [PHP 8](example.php): extensión cURL, emisión y consulta acotada.
- [C# .NET 8](Example.cs): copiar en `Program.cs` de un proyecto console.
- [Java 17](Example.java): `java Example.java /v1/documents/ID`; para emitir, `java Example.java /v1/invoices cases/ARCHIVO.json CLAVE_PERSISTIDA` después de sustituir empresa.
- [Postman](factosys.postman_collection.json): importar, configurar variables y ejecutar solicitudes seleccionadas.

Ejecutar PHP/TypeScript desde `docs/integracion` con ruta del JSON. TypeScript requiere el SDK publicado o resuelto en el workspace; desde la raíz puede usarse `pnpm exec tsx docs/integracion/example.ts docs/integracion/cases/01-01-credito-cuotas.json`. Nunca guardar API keys, certificados ni contraseñas en estos archivos o en colecciones exportadas.

Los 26 archivos de `cases/` cubren los 14 escenarios comerciales de Fase 1, cinco GRE (público, privado, M1, transportista y exportación), boleta, cuatro notas, resumen diario y baja. Se generan sin red con `pnpm exec tsx scripts/build-integration-examples.mjs`. Sustituir `company_id`, fechas, RUC y referencias fiscales por datos de la empresa. Crear las series utilizadas, incluyendo notas FC01/FD01 y GRE T/V. Notas, anticipos, RC y bajas requieren documentos reales previamente emitidos en ese mismo ambiente; el UUID de RC es un placeholder de una boleta. No ejecutar la colección completa indiscriminadamente: contiene una baja y solicitudes incompatibles con referencias de demostración. `gre-*` conserva el emisor de fixture: reemplazarlo por el RUC correspondiente.

## Idempotencia, tickets y errores

Una clave identifica una operación de negocio. Persistir payload y clave antes del POST; ante timeout repetir el mismo payload con la misma clave. Para otra emisión usar otra clave. El servidor reserva correlativos; el cliente no envía `number`. Un 201 registra localmente y no significa aceptación SUNAT. Guardar `id`, consultar `/v1/documents/{id}` y usar eventos/webhooks existentes para conocer el resultado. `failed` requiere revisar traza y reconciliar; no generar otro documento solo porque se perdió la respuesta.

En Postman `idempotency_key` es variable manual: mantenerla en un reintento y cambiarla para otra operación. No reutilizarla para todos los casos. `document_id` y `share_id` se toman de las respuestas; el token compartido solo se devuelve al crear el enlace. La URL relativa compartida se resuelve contra el host API y se abre sin Authorization.

| HTTP          | Manejo                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| 401           | Credencial ausente/inválida/revocada                                                                     |
| 403           | Scope, ambiente o cuota insuficiente                                                                     |
| 404           | Recurso ajeno/inexistente, token expirado/revocado o archivo no permitido                                |
| 409           | Estado fiscal incompatible, operación concurrente, idempotencia conflictiva o archivo aún no descargable |
| 422           | Payload/regla/capacidad no soportada                                                                     |
| 429           | Respetar Retry-After y backoff                                                                           |
| 5xx / timeout | Resultado de transporte incierto; conservar clave y consultar traza                                      |

Rechazo SUNAT es un estado fiscal persistido con código/mensaje; no confundirlo con un timeout de HTTP. Conservar `request_id` para soporte sin registrar credenciales. Webhooks existentes: validar firma HMAC, deduplicar eventos por su identificador, aceptar rápido y procesar localmente; consultar traza ante inconsistencias. No reenviar documentos desde un consumidor de webhook.

Los lenguajes son ejemplos de cliente; no se conectan a SUNAT directamente. El checklist distingue pruebas locales de aceptación real y de entrega real al buzón.

Validación local de ejemplos: `pnpm exec tsx scripts/validate-integration-examples.mjs`; TypeScript y C# compilados, PHP/Java revisados sin runtime instalado. Antes de exportar Postman borrar variables SOL/OAuth/API key.

## Compatibilidad TXT (fase 6)

Facturas, boletas y notas 01/03/07/08 también aceptan Factosys TXT v1 mediante
`text/plain; charset=utf-8`, conservando scopes, idempotencia y respuestas JSON.
Ver [contrato, límites y evidencia](../phase6-compatibility.md),
[archivo de factura](../../examples/phase6/invoice.txt) y
[colección Postman TXT](../../examples/phase6/factosys-txt.postman_collection.json).
Contingencia física y nuevas extensiones sectoriales permanecen sin habilitar;
offline/reseller tienen [diseño separado](../phase6-optional-design.md).
