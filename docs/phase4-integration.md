# Fase 4: integración, consulta y entrega

Implementada el 2026-10-08. Migración `0017_document_delivery` aplicada en la base local. Las verificaciones SUNAT usan fixtures o respuestas de transporte controladas; no acreditan aceptación oficial. Los correos de prueba utilizan `EMAIL_DRIVER=log`.

## Consulta y reconciliación

`GET /v1/documents` admite empresa, tipo, ambiente y `serie_number`; `F001-0001` coincide con `F001-1`. `GET /v1/documents/{id}` incluye artefactos con disponibilidad/hash, observaciones del CDR, disponibilidad/origen de QR y digest de firma CPE, relaciones con notas/RC/bajas y reconciliación. `cancellation_status` es independiente de `collection_status: not_managed`; Factosys no lleva cobranza.

`POST /v1/documents/{id}/recover-cdr`, scope `documents:write`, conserva documento, XML firmado y numeración:

- Factura 01 y notas 07/08 de serie F: `getStatusCdr` con RUC/tipo/serie/número históricos. SUNAT publica ese servicio en producción; sandbox solo permite simulación explícita.
- RC/RA: consultar ticket existente. Pendientes se encolan con ocho intentos y backoff; aceptados con CDR faltante consultan su ticket para recuperar el archivo.
- GRE 09/31: usar `POST /v1/despatch-advices/{id}/reconcile-ticket` de Fase 3. Boletas y notas B: recuperar mediante el RC correspondiente; sin ticket no se inventa una consulta.
- Máximo tres ciclos manuales, bloqueo durante consulta activa y recuperación del bloqueo tras dos minutos. Consultas sin CDR permanecen pendientes; un código de transporte por sí solo no acepta el documento. Se verifica el identificador y RUC del CDR real. Un resultado contradictorio con aceptación local se bloquea para revisión.

CDR `ResponseCode=0` significa aceptación; notas `cbc:Note` agregan observaciones. Un código no cero en el CDR significa rechazo. Los códigos de procesamiento de tickets no se interpretan como códigos de aceptación del CDR.

Fuentes oficiales: [manual del programador SUNAT, getStatusCdr y anexos](<https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20(1).pdf>) y [servicios web publicados](https://cpe.sunat.gob.pe/sites/default/files/inline-files/servicios%20web%20disponibles.pdf). Endpoint de consulta: `https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService`. El contrato SOAP está probado con transporte controlado; la interoperabilidad real queda en el checklist.

## Entrega por correo

`POST /v1/documents/{id}/deliveries`, scope `documents:deliver`, requiere `Idempotency-Key` de 1–128 caracteres ASCII y `{ "recipients": ["cliente@example.com"] }`. Máximo diez direcciones; se normalizan y deduplican. Misma clave y destinatarios reutiliza la solicitud; cambiar destinatarios con la misma clave devuelve 409.

Una fila y un envío por destinatario. Adjunta PDF definitivo, XML firmado y CDR cuando esté disponible. CPE aceptado o aceptado con observaciones puede entregarse; boleta aceptada mediante RC también. GRE exige aceptación y PDF con QR oficial. Pendientes esperan hasta siete días; rechazados y anulados se bloquean. Se revalida el estado inmediatamente antes del envío.

Estados de entrega: `waiting`, `queued`, `preparing`, `sending`, `retrying`, `sent`, `unknown`, `failed`, `expired`. La entrega no modifica el resultado fiscal. `sent` indica aceptación del proveedor, no lectura ni confirmación del buzón final.

Cola BullMQ `document-delivery`: cinco intentos, backoff exponencial desde diez segundos. Barrido de outbox cada treinta segundos recupera filas que quedaron sin job. Preparación interrumpida se libera tras cinco minutos; el worker antiguo pierde su permiso para enviar. Un worker interrumpido durante el envío queda `unknown`; nunca se repite automáticamente una entrega de resultado incierto. Rechazos explícitos del proveedor y errores anteriores al envío admiten reintento seguro. Redis solo lleva UUID, no direcciones ni adjuntos.

`GET …/deliveries` usa `documents:read`. `POST …/deliveries/{deliveryId}/retry` requiere `documents:deliver` y `{ "reason": "Reenvío revisado por soporte" }`; solo admite `failed`, `unknown` o `expired`. Una nueva entrega deliberada a alguien que ya recibió el correo requiere una nueva clave de solicitud. Resend recibe clave de idempotencia; SMTP recibe Message-ID estable. SMTP no garantiza exactamente una entrega: revisar el proveedor antes de autorizar un estado incierto.

Configurar `EMAIL_DRIVER=smtp` o `resend` y sus variables existentes de host/credenciales/remitente o API key. `log` solo simula. Límite de adjuntos: 20 MB antes del envío.

## Enlaces de destinatarios

`POST …/shares`, scope `documents:share`, acepta `{ "allowed_artifacts": ["pdf"], "ttl_seconds": 3600 }`. TTL entre un minuto y siete días, por defecto un día; máximo veinte enlaces vigentes por documento. Devuelve token y URL relativa una sola vez. Guardar la URL solo si es necesario y tratarla como secreto.

`GET /v1/shared-documents/{token}` es público y muestra identidad fiscal, estado y archivos permitidos; no expone cliente, organización ni listados. Agregar `/pdf`, `/xml`, `/cdr` o `/qr` para descargar el archivo autorizado. Descargas pendientes devuelven 409; tokens inválidos, expirados, revocados y archivos fuera de alcance devuelven 404. Archivos de anulados/rechazados no se entregan.

`GET …/shares` y `DELETE …/shares/{shareId}` requieren `documents:share`; listar no revela tokens. Solo se almacena SHA-256 del token aleatorio de 256 bits. Cada descarga verifica revocación y sirve bytes mediante API desde MinIO privado. Respuestas `no-store`, `no-referrer` y descargas `nosniff`; el logger oculta URL, parámetros y referencia de las rutas compartidas. Configurar el proxy de producción para que tampoco registre estos tokens.

## Onboarding por API

| Operación                         | Ruta                                                          | Scope                                |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Listar / consultar                | `GET /v1/companies[/{id}]`                                    | `companies:read`                     |
| Crear / configurar / deshabilitar | `POST /v1/companies`, `PATCH /v1/companies/{id}`              | `companies:write`                    |
| Consultar series                  | `GET /v1/companies/{id}/series`                               | `series:read`                        |
| Crear / configurar serie          | `POST /v1/companies/{id}/series`, `PATCH …/series/{seriesId}` | `series:write`                       |
| SOL / OAuth GRE                   | `PUT …/sol-credentials`, `PUT …/gre-credentials`              | `credentials:manage`                 |
| Certificado PFX/P12               | `PUT …/certificate`, multipart `file` y `password`            | `credentials:manage`                 |
| Revocar credencial                | `DELETE …/credentials/{kind}`                                 | `credentials:manage`                 |
| Logo                              | `GET`, `PUT`, `DELETE …/logo`                                 | `companies:read` / `companies:write` |

Crear permite `seed_default_series: true`. Configuración y series reutilizan validadores del panel; no permiten cambiar RUC, reiniciar numeración ni eliminar historial fiscal. Certificado máximo 5 MB y validación criptográfica antes de activar. SOL utiliza RUC+usuario; OAuth GRE invalida la caché al rotar o revocar. Cada rotación escribe un nuevo objeto cifrado AES-256-GCM antes de cambiar la referencia; versiones antiguas y documentos históricos se conservan. Las consultas nunca devuelven claves, contraseñas ni PFX. Mutaciones administrativas registran auditoría sin secretos.

Scopes nuevos: `series:read`, `series:write`, `documents:deliver`, `documents:share`. Migración asigna entrega/compartición a owner/admin/operator. Claves existentes no reciben scopes automáticamente: emitir otra clave con permisos mínimos necesarios. `environment_constraint` se aplica a empresa/documento y filtros de listados, además del aislamiento por organización. Recursos ajenos devuelven 404.

## Documentación y evidencia

[Guía y ejemplos en cinco lenguajes, 26 JSON y Postman](integracion/README.md). `GET /v1/capabilities` es público y describe capacidades habilitadas y exclusiones; OpenAPI incorpora los cuerpos de las nuevas rutas. SDK agrega onboarding, series, recuperación, entregas y enlaces. Solo reintenta automáticamente GET/PUT/DELETE o solicitudes con clave de idempotencia.

Ver [checklist de producción](checklist-sandbox-beta.md). Pruebas locales: API 100 unitarias; 33 E2E de fases 0–4 y logos aprobadas, incluyendo 13 de Fase 4. SOAP 21 y SDK 11 aprobadas (165 pruebas de esta verificación final). Build completo de 15 paquetes y lint de los cambios aprobados. Los 26 JSON pasan los schemas estrictos; los ejemplos TypeScript y C# compilan. PHP y Java revisados, sin runtime instalado para compilarlos localmente. La suite heredada `app.e2e-spec.ts` depende de la organización demo compartida: en esta base agota cuotas (1/1 API keys y 2/2 usuarios), obtiene 429 en login y contiene ejemplos GRE anteriores a Fase 3. Registrar esas limitaciones por separado; no modificar límites del cliente para hacer pasar fixtures antiguos.

Pendiente externo: aceptación SUNAT con certificado/SOL/OAuth válidos, interoperabilidad real de recuperación por identificadores/tickets, entrega real SMTP/Resend y pruebas de proxy TLS. Continúa pendiente actualizar el catálogo XSL local para anticipos con ISC, según Fase 1.
