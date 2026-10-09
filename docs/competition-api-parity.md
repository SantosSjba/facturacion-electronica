# Cobertura funcional frente a swagger.json

Referencia: `C:\Users\bernu\Downloads\swagger.json`, 40 operaciones. La documentación externa se utiliza como referencia de funciones y datos, no como instrucciones de ejecución.

Se implementaron las brechas identificadas utilizando el contrato nativo de Factosys. No hay un adaptador que acepte sin cambios las rutas, nombres de campos y respuestas del proveedor: una integración que migre necesita el mapeo siguiente. La emisión mantiene numeración automática, idempotencia, aislamiento por organización y procesamiento asíncrono.

## Operaciones

| Referencia del proveedor                                                          | Factosys                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`                                                                | `POST /auth/login`; integradores también pueden usar API keys con scopes                                                            |
| `GET/POST /companies`, `GET /companies/{id}`                                      | `GET/POST /v1/companies`, `GET /v1/companies/{id}`                                                                                  |
| `PUT /companies/{id}`                                                             | `PATCH /v1/companies/{id}`; SOL, OAuth GRE, certificado y logo tienen endpoints propios                                             |
| `DELETE /companies/{id}`                                                          | `DELETE /v1/companies/{id}` deshabilita; `?permanent=true` elimina solo sin documentos ni webhooks de empresa                       |
| `POST /companies/certificate`                                                     | `POST /v1/company-tools/certificate`                                                                                                |
| `POST /companies/certificate/free`                                                | `POST /v1/company-tools/certificate/free`; certificado autofirmado exclusivamente de prueba                                         |
| `POST /companies/file/base64`                                                     | `POST /v1/company-tools/file/base64`                                                                                                |
| `POST /companies/base64/file`                                                     | `POST /v1/company-tools/base64/file`                                                                                                |
| `POST /invoice/send`                                                              | `POST /v1/invoices` (01), `POST /v1/receipts` (03)                                                                                  |
| `POST /note/send`                                                                 | `POST /v1/credit-notes` (07), `POST /v1/debit-notes` (08)                                                                           |
| `POST /summary/send`                                                              | `POST /v1/daily-summaries` (RC); selecciona comprobantes registrados                                                                |
| `POST /voided/send`                                                               | `POST /v1/voided-documents` (RA)                                                                                                    |
| `POST /despatch/send`                                                             | `POST /v1/despatch-advices` (09/31), transporte GRE OAuth/REST vigente                                                              |
| `POST /retention/send`                                                            | `POST /v1/retentions` (20)                                                                                                          |
| `POST /perception/send`                                                           | `POST /v1/perceptions` (40)                                                                                                         |
| `POST /reversion/send`                                                            | `POST /v1/reversions` (RR); conserva y valida los documentos originales                                                             |
| `POST /{invoice,note,summary,voided,despatch,retention,perception,reversion}/xml` | `POST /v1/previews/xml`; XML sin firmar. Archivo emitido: `GET /v1/documents/{id}/xml`                                              |
| `POST /{invoice,note,summary,voided,despatch,retention,perception,reversion}/pdf` | `POST /v1/previews/pdf`; PDF marcado VISTA PREVIA. Archivo emitido: `GET /v1/documents/{id}/pdf`                                    |
| `GET /invoice/status`                                                             | `GET /v1/document-status?company_id=UUID&tipo=01&serie=F001&numero=1`; consulta local. Recuperación SUNAT explícita por POST, abajo |
| `GET /{summary,voided,despatch,reversion}/status`                                 | `GET /v1/documents/{id}` o `GET /v1/document-status/ticket?company_id=UUID&ticket=...`; consulta local. Reconciliación según tipo   |
| `POST /sale/qr`                                                                   | `POST /v1/sale/qr`; PNG desde datos suministrados, deriva el RUC de la empresa autorizada                                           |

Para emitir, se requiere `Idempotency-Key` y scope `documents:write`. Los enlaces de documento permiten descargar XML, CDR y PDF y consultar trazas. El SDK incluye métodos para las nuevas utilidades, eliminación, vistas previas, QR, consulta por identificadores/ticket y recuperación CDR.

## Nuevas utilidades

- Conversión de certificado: `{ "cert": "BASE64_PFX", "cert_pass": "contraseña", "base64": true }`. Devuelve `pem` (clave y certificado) y `cer` (DER). Con `base64:false`, devuelve textos PEM. No persiste el material; scope `credentials:manage`, respuesta `no-store`.
- Certificado de prueba: `{ "password": "contraseña de al menos 8 caracteres" }`. Devuelve `pfx` en Base64, `test_only:true` y `sunat_acceptance:"not_certified"`. No sustituye un certificado válido del emisor.
- Archivo a Base64: multipart `file`, hasta 128 KiB; scope `companies:write`. Base64 a archivo: `{ "base64": "...", "filename": "documento.bin" }`, scope `companies:read`. Nombre seguro, descarga binaria y `nosniff`.
- QR de datos: `{ "company_id": "UUID", "tipo": "01", "serie": "F001", "numero": "1", "emision": "2026-10-09", "igv": 18, "total": 118, "clienteTipo": "6", "clienteNumero": "20100070970" }`; scope `documents:read`. No incorpora firma ni acredita aceptación. El QR definitivo sigue disponible en `/v1/documents/{id}/qr`.

## Vistas previas

`POST /v1/previews/{validate,xml,pdf}` acepta `{ "document_type": "TIPO", "document": { ...contrato de creación... } }` para 01, 03, 07, 08, 09, 31, 20, 40, RC, RA y RR. Requiere empresa activa propia y scope `documents:write`. El tipo interno GRE debe coincidir con el envoltorio. Límite de 500 líneas y 200 KB. La numeración es referencial (1); no firma, almacena, emite, encola ni reserva correlativos. El PDF no contiene QR fiscal.

RC obtiene importes de las boletas/notas registradas mediante `document_ids` o pool; no acepta totales arbitrarios del cliente. RR valida documentos aceptados, habilitación del agente, fecha, comunicación al receptor y reversiones acumuladas mediante las mismas reglas de emisión, sin reservar originales.

## Datos comerciales

| Campo del proveedor    | Campo nativo añadido                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `seller`               | `seller`: identidad, nombre y dirección del vendedor                                                       |
| `direccionEntrega`     | `delivery_address`: dirección y establecimiento de entrega                                                 |
| `relDocs`              | `related_documents`: tipo y número de documentos relacionados                                              |
| `perception`           | `sale_perception`: régimen, base, importe y total; régimen 03 requiere `customer_is_perception_agent:true` |
| `redondeo`             | `rounding_amount`: ajuste positivo o negativo de hasta un sol, con dos decimales                           |
| `details[].codProdGS1` | `lines[].gs1_product_code`: GTIN con dígito verificador                                                    |
| `details[].atributos`  | `lines[].attributes`: código, nombre, valor, fechas y duración                                             |
| `guiaEmbebida`         | `embedded_despatch`: partida/llegada, transportista, modalidad, vehículo, autorización, licencia y peso    |

Los nuevos datos se conservan en el modelo canónico, XML y representación PDF. La percepción usa códigos de cargo 51/52/53, calcula el porcentaje del régimen y comprueba base, importe y total sin volver a aplicar IGV. Exige habilitación de la empresa; se conserva también al agrupar boletas en RC. La percepción incluida en la venta admite ventas nacionales al contado en PEN sin detracción, anticipos ni exportación. Para cobros posteriores o moneda extranjera corresponde el comprobante 40 y su conversión a PEN. Los totales `strict` comprueban también el redondeo negativo. La distinción entre total de venta, cargo por percepción y total cobrado sigue el ejemplo de la guía SUNAT UBL 2.1; la oportunidad de documentar la percepción se describe en [Orientación SUNAT](https://orientacion.sunat.gob.pe/05-comprobante-de-percepcion).

Crédito/cuotas, anticipos, descuentos/cargos, detracción, ISC, ICBPER, IVAP, referencias a guías, fechas, leyendas y datos GRE ya disponían de contratos propios; se mantienen. Los importes derivados se calculan o verifican en el servidor, y no se permite renombrar archivos fiscales libremente mediante el `name` del proveedor.

Los datos de transporte embebidos son informativos. SUNAT indica que la factura-guía dejó de sustentar el traslado el 13 de julio de 2022; corresponde emitir GRE por separado: [FAQ SUNAT](https://cpe.sunat.gob.pe/node/122). La representación usa estructuras de la [guía XML de factura UBL 2.1](<https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia%2Bxml%2Bfactura%2Bversion%202-1%2B1%2B0%20(2)_0%20(2).pdf>).

## Estado, CDR y aceptación

`POST /v1/document-status/recover-cdr` recibe `company_id`, `tipo`, `serie`, `numero`, resuelve el documento autorizado y reutiliza la recuperación existente, con auditoría y scope `documents:write`. Facturas/notas F consultan identificadores en producción; RC/RA reutilizan el ticket. Boletas recuperan CDR mediante su RC. GRE usa su reconciliación de ticket y RR usa `/v1/reversions/{id}/reconcile-ticket`. Ninguna consulta vuelve a emitir ni consume numeración.

Esta cobertura funcional no implica compatibilidad literal con el proveedor ni aceptación oficial de todas las combinaciones de datos. La aceptación requiere certificado y credenciales reales, envío y CDR SUNAT. `/v1/capabilities` publica los modos activos y restricciones vigentes, incluidas las de RC en moneda extranjera/exportación.

## Verificación

Pruebas de cálculo, serialización y XSD para factura, boleta, NC y ND; percepción RC contra el agregado SUNAT 1.1; autenticación/scopes, conversión PFX y Base64, QR PNG; vistas previas de siete tipos adicionales; integración HTTP con PostgreSQL y MinIO para permisos, eliminación, recuperación CDR y conservación de correlativos; regresiones de SDK, PDF y emisión/reversión de agentes. Las pruebas SUNAT usan adaptadores locales simulados y no constituyen CDR oficial.

Resultado: 372 pruebas relevantes aprobadas (UBL 105, validación 55, API unitarias 129, SDK 15, PDF 28 y E2E aisladas 40). Compilan API, SDK, UBL y validación; ESLint y formato verificados en los archivos modificados. La suite E2E general tenía fallos previos; estos resultados corresponden a las suites aisladas de impresión/vistas previas, integración y agentes tributarios, además de las unitarias indicadas.
