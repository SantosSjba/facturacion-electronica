# Roadmap de la API: aportes de APISPERU y NubeFact

Fecha de revisión: 2026-10-08. Estado: fase 0 implementada y verificada localmente; fases 1-6 pendientes. Ver [contrato y evidencia de fase 0](./phase0-cpe-integrity.md).

Objetivo: ampliar Factosys con las funciones útiles de ambos competidores, empezando por la integridad del comprobante y siguiendo con casos comerciales, impresión, GRE e integración. El orden depende de las correcciones del motor y del valor para los clientes; no representa fechas comprometidas.

Se conserva el [alcance del producto](./alcance-producto.md): API de emisión y paneles de configuración y administración. No se agregan caja, inventario, catálogo comercial ni un facturador manual.

## 1. Fuentes y límites de la comparación

Las páginas citadas son páginas físicas del PDF, contando la portada como página 1.

| Referencia | Documento revisado                                                                                            | Evidencia relevante                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A          | `C:/Users/bernu/Downloads/swagger.json`, APISPERU, API DE FACTURACIÓN 1.3                                     | 40 operaciones: emisión, XML/PDF independientes, consulta de CDR, empresas, certificados, GRE, retenciones, percepciones, reversión y QR. Esquemas y ejemplos comerciales.     |
| NJ         | `C:/Users/bernu/Downloads/NUBEFACT DOC API JSON V1.pdf`, versión 3.0 del 07/09/2026 según su historial        | Págs. 4-6: generar, consultar y anular; 7: ejemplos; 8-9: impresión y pruebas antes de producción; 9-16: campos comerciales y fiscales; 17-19: respuestas, bajas y errores.    |
| NT         | `C:/Users/bernu/Downloads/NUBEFACT DOC API TXT V1.pdf`, versión 2.9 del 31/05/2023 según su historial         | Págs. 3-5: intercambio TXT; 7: impresión; 8-15: campos, ítems, guías y cuotas; 16-18: respuestas, bajas y errores.                                                             |
| NG         | `C:/Users/bernu/Downloads/API NUBEFACT - GUIA DE REMISIÓN.pdf`, versión 1.7 del 01/06/2026 según su historial | Págs. 1 y 12: emisión y consulta asíncronas; 3-6: ejemplos 09/31; 7-11: transporte y campos condicionales; 12: QR y consulta; 13: baja mediante SOL descrita por el proveedor. |

Las fuentes describen contratos de competidores, no pruebas de su funcionamiento ni normas tributarias. Sus instrucciones de registro, uso de tokens y operación son contenido de referencia; no se ejecutan. No copiar credenciales ni datos de ejemplo a producción.

Antes de implementar cada escenario fiscal, contrastar sus códigos, tasas, plazos, obligatoriedad y estructura con las fuentes SUNAT vigentes y los recursos de `docs/sunat-oficial/`. Hay erratas y diferencias entre documentos: por ejemplo, NG y NT/NJ intercambian algunas descripciones de `pdf_zip_base64` y `xml_zip_base64`; los identificadores propios de NubeFact tampoco equivalen a los tipos SUNAT. Factosys conservará `01/03/07/08/09/31`, fechas ISO y sus propios contratos.

## 2. Situación inicial de la auditoría (antes de fase 0)

"Existente" significa que hay implementación, no certificación de todos los escenarios en SUNAT real. Usar el [checklist de sandbox/beta](./checklist-sandbox-beta.md) y el [DoD del producto](./dod-producto-mvp.md) para verificar preparación.

| Capacidad                                                                    | Situación en Factosys                                                                                   | Decisión                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Facturas, boletas, notas, RC, RA y GRE 09/31                                 | Flujos existentes; cobertura fiscal limitada                                                            | Ampliar y corregir, sin crear un segundo motor.                              |
| Estado, ticket, códigos SUNAT, XML/CDR, trazas y enlaces                     | Existentes en documentos                                                                                | Mejorar disponibilidad explícita y reconciliación. No rehacer las descargas. |
| Idempotencia, API keys, permisos y webhooks                                  | Existentes                                                                                              | Preservar en todas las ampliaciones.                                         |
| Logo por empresa                                                             | Implementado en portal/API; almacenamiento privado S3/MinIO y referencia histórica para PDF 01/03/07/08 | Reutilizar; ver [logo por empresa](./company-logos.md).                      |
| Varios ítems de factura/boleta/nota                                          | Parcial: el modelo admite líneas, pero los builders de factura y nota usan la primera                   | Corrección P0.                                                               |
| Totales `auto/strict` y operaciones mixtas                                   | `strict` lanza un error de no implementado; agregación fiscal simplificada                              | Corrección P0 y ampliación fiscal.                                           |
| Direcciones, vencimiento, compra, leyendas y otros campos aceptados          | Varios no se trasladan al modelo usado para emitir factura                                              | Auditoría de punta a punta; no aceptar datos para descartarlos.              |
| Crédito/cuotas, descuentos, anticipos, detracción y tributos adicionales     | Soporte completo pendiente; campos libres no prueban soporte                                            | Modelos tipados, cálculo, XML, PDF y ejemplos.                               |
| PDF 01/03/07/08                                                              | Existente y con logo; QR mostrado como texto; faltan datos comerciales en el flujo                      | QR escaneable y representación fiel.                                         |
| PDF GRE y QR oficial GRE                                                     | PDF no cubre 09/31; el contrato del adaptador GRE no expone QR dedicado                                 | Añadir después de validar respuesta/CDR oficial.                             |
| Vehículos, conductores y documentos relacionados GRE                         | Arrays y serialización existentes                                                                       | Validar roles y casos; no clasificarlos como totalmente ausentes.            |
| Fecha de entrega al transportista, indicadores, subcontratador y pagador GRE | No aparecen como campos explícitos en el contrato revisado                                              | Ampliar contrato y builder.                                                  |
| Empresa/certificado mediante integración automatizada                        | Gestión general orientada a JWT del panel; logo sí acepta API key                                       | API administrativa opcional con scopes concretos.                            |
| Enviar comprobantes al destinatario por correo                               | Hay infraestructura de email para notificaciones SaaS; falta el flujo específico CPE/GRE                | Reutilizar infraestructura con cola y estado de entrega.                     |
| Retención, percepción y reversión como documentos propios                    | Sin endpoints/motor específico en la API revisada                                                       | Fase posterior con demanda comercial.                                        |
| TXT para sistemas antiguos                                                   | Ausente                                                                                                 | Adaptador opcional al mismo contrato canónico.                               |

### Evidencia técnica de la auditoría inicial (antes de fase 0)

- `packages/sunat-ubl/src/adapters/invoice-xml.builder.ts`: usa `canonical.lines[0]`, genera una sola `InvoiceLine` y fija la forma de pago como `Contado`.
- `packages/sunat-ubl/src/adapters/note-xml.builder.ts`: usa `canonical.lines[0]`; requiere corrección y pruebas específicas de crédito/débito.
- En la auditoría anterior, una factura de dos ítems produjo dos líneas canónicas y una sola línea XML; el segundo producto no apareció y el total pagadero fue 236. Es evidencia local del builder, no una emisión aceptada por SUNAT.
- `packages/sunat-ubl/src/totals/auto-totals.ts`: rechaza `strict` como no implementado y simplifica el esquema/categoría fiscal de cabecera.
- `apps/api/src/infrastructure/documents/emit-invoice.use-case.ts`: el mapeo omite varios datos aceptados en el DTO, incluyendo vencimiento, compra, dirección, leyendas, detracción y medios de pago.
- `packages/pdf-ri/src/templates/ri-cpe.html.ts` imprime `qrPayload` como texto; `apps/api/src/infrastructure/pdf/pdf.service.ts` limita PDF a 01/03/07/08 y no completa los datos de nota que contempla el puerto.
- `apps/api/src/interfaces/http/dto/despatch-advice-create.schema.ts` y `packages/sunat-ubl/src/adapters/despatch-advice-xml.builder.ts` ya contemplan vehículos/conductores múltiples; faltan campos y validaciones de los escenarios avanzados.

## 3. Orden de implementación

| Fase | Prioridad | Resultado esperado                                                 | Dependencia                                           |
| ---- | --------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| 0    | P0        | Solicitud, XML y totales coherentes; datos soportados sin pérdidas | Ninguna                                               |
| 1    | P1        | Casos comerciales habituales y fiscalidad ampliada                 | Fase 0                                                |
| 2    | P1        | PDF útil, QR real, formatos y vistas previas                       | Fase 0; incorporar cada caso de fase 1 al completarlo |
| 3    | P1        | GRE más completa y representación con QR oficial                   | Fase 0 y base PDF de fase 2                           |
| 4    | P1/P2     | Consulta/reconciliación, entrega al cliente y mejor integración    | Fase 0; entrega GRE depende de fase 3                 |
| 5    | P2        | Documentos de retención, percepción y reversión                    | Motor de fase 1 y demanda confirmada                  |
| 6    | P3        | Compatibilidad TXT y extensiones de mercado seleccionadas          | Contrato JSON estable                                 |

Los IDs siguientes son tareas propuestas. Cada casilla se marca cuando hay evidencia del criterio de aceptación, no solo cuando existe un endpoint.

## Fase 0. Integridad del motor de emisión

Fuentes: A (`Invoice`, `SaleDetail`, `Note`); NJ págs. 5, 10 y 15-16; NT págs. 13-15.

- [x] **F0-01. Todas las líneas.** Serializar todas las líneas de factura/boleta y de notas de crédito/débito, manteniendo cantidades, unidades, precios, afectación y referencias.
- [x] **F0-02. Totales fiscales.** Calcular y agrupar bases/impuestos por categoría, esquema y tasa; distinguir gravadas, exoneradas, inafectas, gratuitas y exportación. Definir precisión decimal y redondeo por etapa.
- [x] **F0-03. Contrato sin pérdidas.** Inventariar cada campo del DTO y su destino: persistencia, canónico, cálculo, XML y/o PDF. Conectar direcciones, fechas, compra, códigos de producto y leyendas según su finalidad. Rechazar claramente campos/casos todavía no soportados antes de emitir.
- [x] **F0-04. Totales estrictos.** Implementar `strict` con comparación de bases, impuestos y pagadero frente al cálculo; documentar tolerancias. Mientras esté pendiente, comunicar su indisponibilidad en el contrato y devolver un error de dominio controlado.

**Evidencia de cierre local:** [contrato, límites y pruebas](./phase0-cpe-integrity.md). La aceptación real de los escenarios nuevos se verifica en el checklist SUNAT.

**Aceptación:** fixtures con 1, 2 y muchos ítems conservan todas las líneas y sus importes en XML/PDF; casos de impuestos mixtos no heredan la categoría del primer ítem; `strict` acepta importes coherentes y rechaza discrepancias con ruta del campo. Validación XSD y reglas aplicables, más pruebas específicas de los cálculos. La prueba de dos ítems de la auditoría pasa sin perder el segundo producto.

## Fase 1. Casos comerciales y fiscales

Fuentes: A (`PaymentTerms`, `Cuota`, `Detraction`, `Prepayment`, descuentos/cargos de `SaleDetail` y ejemplos); NJ págs. 7, 9-16; NT págs. 8-15.

- [ ] **F1-01. Contado y crédito.** Forma de pago tipada, saldo pendiente, moneda, cuotas con número/fecha/importe y vencimiento; mapear a UBL y PDF. Validar coherencia de cuotas con el saldo. Separar condición de pago, medio de pago y estado de cobro.
- [ ] **F1-02. Descuentos y cargos.** Por línea y globales, con motivo, base, factor/importe y tratamiento fiscal. Cubrir combinaciones y descuentos que no afectan la base cuando corresponda.
- [ ] **F1-03. Anticipos.** Referenciar documentos de anticipo, emisión y regularización; conciliar anticipos, impuestos y saldo para evitar descontarlos dos veces.
- [ ] **F1-04. Detracción.** Código del bien/servicio, tasa, monto, cuenta y medio de pago; extender después a transporte de carga con origen/destino, viaje, valores referenciales y tramos. Hidrobiológicos y pasajeros se habilitan por escenario validado.
- [ ] **F1-05. Tributos adicionales.** ICBPER, ISC e IVAP por línea y cabecera con fórmulas específicas y casos gratuitos cuando proceda. No tratar todos los impuestos como IGV.
- [ ] **F1-06. Operaciones y documentos relacionados.** Exportación, no domiciliados, gratuidad y referencias a guías; notas por descuentos, devoluciones y ajustes de cuotas. Incorporar catálogos y restricciones por tipo de documento.
- [ ] **F1-07. Moneda y tipo de cambio.** La moneda ya existe; definir cuándo corresponde registrar tipo de cambio, su fuente/fecha y su representación, sin convertir automáticamente importes sin contrato explícito.

**Aceptación:** cada escenario habilitado tiene request documentado, canónico, XML firmado validado, totales coherentes y PDF equivalente. Incluir fixtures positivos y negativos: contado, dos cuotas, descuento global + línea, anticipo parcial, detracción, ICBPER, ISC, IVAP, exportación y nota asociada. Validar los escenarios mediante SUNAT real cuando el ambiente permita hacerlo; identificar explícitamente los que solo tengan cobertura Fake.

## Fase 2. Representación impresa y vistas previas

Fuentes: A (`/sale/qr`, rutas `/invoice/xml`, `/invoice/pdf`, equivalentes de notas/resúmenes/bajas/GRE); NJ págs. 8 y 14; NT págs. 7 y 13; NG pág. 9.

- [ ] **F2-01. QR escaneable CPE.** Generar imagen QR con datos del comprobante definitivo y firma; exponer datos para representación propia y, si resulta útil, un recurso QR. Verificar contenido y dimensiones contra especificación oficial aplicable.
- [ ] **F2-02. PDF fiel.** Dirección del emisor/adquirente, todas las líneas, códigos, observaciones, leyendas, compra, vencimiento, cuotas y descuentos/cargos implementados. En notas, motivo y documento afectado. Generar desde el mismo modelo fiscal persistido.
- [ ] **F2-03. Formatos.** A4 y ticket de 80 mm primero; A5 y ticket de 58 mm según uso. Configuración por empresa y elección por documento. Versionar formato/plantilla y conservar el PDF histórico y el logo usado al emitir.
- [ ] **F2-04. Prevalidación y preview.** Validar un payload y obtener XML/PDF de vista previa sin envío SUNAT ni consumo de correlativo. Marcar PDF como vista previa; no devolverlo como comprobante aceptado. Reutilizar el motor y permisos, con límites de tamaño/costo.
- [ ] **F2-05. RC/RA.** Evaluar una representación de resumen/baja con ticket y resultado; distinguirla del PDF de una factura. Su prioridad depende de la necesidad de los integradores.

**Aceptación:** un lector de QR recupera los datos esperados; documentos largos y muchas líneas no se recortan en A4/ticket; las notas muestran su referencia; XML/PDF coinciden. Preview no cambia numeración, no envía a SUNAT y no genera eventos de aceptación. Cambiar el logo o la plantilla no altera PDFs históricos.

## Fase 3. GRE remitente y transportista

Fuentes: A (`Despatch`, envío, transportista, vehículos/conductores y documentos asociados); NG págs. 1 y 3-12.

- [ ] **F3-01. Campos nuevos.** Fecha de entrega de bienes al transportista, separada del inicio de traslado; validar condiciones para GRE remitente y transporte público con fuentes oficiales.
- [ ] **F3-02. Roles y habilitación.** Revisar vehículo/conductor principal y secundarios, licencias, MTC y TUC/habilitación. Los arrays actuales se reutilizan; verificar que su estructura UBL conserva cada rol.
- [ ] **F3-03. Indicadores y terceros.** Indicadores de retorno, vehículos M1/L y transporte subcontratado; identificación de subcontratador y pagador de flete. Usar campos tipados y reglas condicionales, sin copiar el único selector propietario de NubeFact como modelo fiscal.
- [ ] **F3-04. Motivos y aduanas.** Validar motivos, descripción de "otros", establecimientos, unidades de peso, bultos, DAM/DS y referencias por ítem cuando correspondan. Conservar múltiples documentos relacionados.
- [ ] **F3-05. QR y PDF GRE.** Extraer/persistir el dato oficial de QR de la respuesta/CDR que corresponda; producir PDF 09/31 con logo histórico y datos del traslado. Diferenciar artefactos disponibles y pendientes. El QR GRE no debe fabricarse con el payload del QR de factura.
- [ ] **F3-06. Duplicados y baja.** Diseñar reconciliación para casos como el error 1033 sin reenviar indefinidamente. Documentar el procedimiento vigente para bajas GRE y separar su tratamiento de RA/RC de CPE; confirmar si existe una operación oficial utilizable antes de prometer un endpoint.

**Aceptación:** escenarios 09 público/privado y 31 con secundarios, subcontratador/pagador y documento aduanero conservan los campos en XML validado. El worker consulta tickets con reintentos acotados; el cliente distingue pendiente, rechazo y aceptación. El PDF GRE definitivo usa el QR oficial y queda ligado a la versión histórica del logo. No se recrea el flujo asíncrono ya existente.

## Fase 4. Integración, consulta y entrega al cliente

Fuentes: A (empresas/certificados y `/invoice/status`); NJ págs. 3, 6-9 y 17-19; NT págs. 3, 16-18; NG págs. 11-12.

- [ ] **F4-01. Consulta útil.** Reutilizar filtros por empresa, tipo y serie/número. Completar respuesta con disponibilidad de artefactos, observaciones SUNAT, información de QR/hash cuando corresponda y relación con baja/RC/RA. Mantener el estado de anulación separado del estado de cobro.
- [ ] **F4-02. Recuperación y reconciliación.** Recuperar CDR desde SUNAT por identificadores para los tipos que lo soporten, además de consultar tickets. Reconciliar ante timeout o documento previamente registrado; no repetir emisión ni consumir nuevo correlativo. La consulta de validez CPE actual no sustituye esta recuperación.
- [ ] **F4-03. Entrega de comprobantes.** Envío opcional al destinatario, varios correos y reenvío autorizado. Reutilizar servicio de email, agregar cola, reintentos, deduplicación y estado propio de entrega. Para GRE, enviar representación definitiva al estar aceptada; definir política explícita para CPE pendientes/observados. Una falla de correo no cambia el resultado fiscal.
- [ ] **F4-04. Acceso a archivos para destinatarios.** Además de descargas autenticadas existentes, evaluar enlaces temporales o una consulta compartida por documento, con token limitado a ese documento y revocable. Mantener MinIO privado; no incluir API keys en enlaces ni exponer listados de la organización.
- [ ] **F4-05. Onboarding automatizado.** CRUD de empresa/configuración, series y certificados para integradores que administran varios RUC, con scopes específicos, aislamiento por organización, auditoría, rotación y secretos cifrados. Reutilizar la gestión existente del panel y evitar borrado destructivo del historial fiscal.
- [ ] **F4-06. Documentación para integradores.** Matriz visible de capacidades reales, ejemplos por caso comercial, colección de pruebas y ejemplos cURL/PHP/C#/Java/TypeScript. Documentar idempotencia, tickets, reintentos, webhooks, errores y diferencias sandbox/producción; extender SDK existente conforme se incorporen funciones.
- [ ] **F4-07. Verificación de salida a producción.** Ampliar checklist existente con los casos NJ págs. 8-9: monedas, impuestos mixtos, notas, baja, consulta y artefactos, añadiendo GRE cuando se habilite. Conservar resultados y separar transporte simulado de aceptación oficial.

**Aceptación:** consultar/reconciliar no duplica documentos; errores distinguen validación, rechazo SUNAT y transporte. Un mensaje de correo tiene estado rastreable y reintentos sin duplicación deliberada por evento. Enlaces y API administrativa no permiten acceso entre organizaciones. Cada función pública nueva incluye contrato, ejemplo y comportamiento de error.

## Fase 5. Documentos fiscales especializados

Fuente principal: A (`Retention`, `Perception`, `Reversion` y sus rutas). NJ menciona manuales separados de retención/percepción en la pág. 1, pero no contiene sus contratos completos.

- [ ] **F5-01. Retención electrónica.** Modelo propio, documentos afectados, pagos, monedas/tipo de cambio, totales, XML/firma/transporte, consulta, CDR y PDF.
- [ ] **F5-02. Percepción electrónica.** Mismo ciclo con reglas específicas de percepción; no reutilizar fórmulas de retención por semejanza de campos.
- [ ] **F5-03. Reversión.** Modelo y flujo vinculados a los documentos que permiten reversión, con ticket/consulta y trazabilidad.

**Aceptación:** contratos oficiales revisados, escenarios positivos/negativos, validación fiscal, artefactos y evidencia de envío real. Confirmar necesidad de clientes y condiciones del emisor antes de activar estos módulos. Distinguir retención/percepción asociadas a una factura (fase 1) de sus comprobantes electrónicos independientes (fase 5).

## Fase 6. Compatibilidad y extensiones opcionales

Fuentes: NT págs. 3-5 y 13-18; NJ págs. 2, 7 y 9; A ejemplos de contingencia y exportación.

- [ ] **F6-01. Adaptador TXT.** Para integradores que lo necesiten, convertir TXT delimitado por `|` a nuestro contrato JSON/canónico y devolver errores con fila/campo. Definir UTF-8, escape, decimales, límites y versión. Misma idempotencia, autorización y validación fiscal; ningún cálculo duplicado.
- [ ] **F6-02. Contingencia.** Flujo explícito de comunicación de comprobantes físicos emitidos en contingencia, con series y reglas propias. No habilitarlo relajando el regex de la emisión electrónica normal.
- [ ] **F6-03. Operaciones sectoriales.** Tax Free, exportación de servicios, beneficios de región selva y detracciones especializadas según cliente, catálogos y normativa verificados. Los códigos NubeCont no aportan valor directo sin una integración contable concreta.
- [ ] **F6-04. Offline y reseller.** Evaluar en un diseño aparte si existe demanda: persistencia local, sincronización, control de correlativos y separación de clientes. La mención de estas modalidades en NubeFact no prueba que Factosys las necesite para su MVP.

**Aceptación:** cada ampliación tiene un cliente/caso de uso identificado y reutiliza el motor estable. TXT y JSON equivalentes generan el mismo resultado fiscal. El modo offline requiere resolver sincronización y duplicados antes de presentarse como capacidad comercial.

## 4. Reglas para ejecutar el roadmap

1. Comenzar por F0-01 y F0-02. Después corregir mapeos y totales estrictos; no ampliar impuestos sobre totales incoherentes.
2. Implementar tareas en cambios pequeños: contrato, modelo, cálculo, XML, persistencia, PDF, SDK y ejemplos según corresponda. Elegir primero crédito/cuotas, descuentos y detracción habitual dentro de fase 1.
3. Mantener colas, tickets y webhooks. Respuesta inmediata no significa aceptación SUNAT; NubeFact GRE también exige consulta posterior. No reemplazar nuestra arquitectura por un POST único con selector `operacion`.
4. Conservar compatibilidad de campos existentes cuando sea posible. Versionar cambios incompatibles y documentar rechazo de capacidades antes aceptadas pero ignoradas; no cambiar silenciosamente el significado fiscal.
5. Reutilizar logos, descargas, email, permisos e idempotencia. No incorporar endpoints genéricos de conversión base64 ni certificados de prueba como funciones de producción por paridad superficial.
6. Para cerrar una tarea, registrar evidencia local y oficial que corresponda; actualizar OpenAPI, ejemplos y matriz de soporte. Fake demuestra el flujo, no conformidad tributaria.

## 5. Registro de avance

| Fase | Estado inicial                              | Evidencia para cerrar                                                                                     | Fecha / cambio                                         |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0    | Implementada; verificación local completada | Líneas, impuestos mixtos/gratuitas, `strict`, firma, XSD, snapshot y PDF; aceptación SUNAT real pendiente | 2026-10-08; ver [evidencia](./phase0-cpe-integrity.md) |
| 1    | Pendiente; base parcial                     | Casos comerciales completos por escenario                                                                 | Por completar                                          |
| 2    | Pendiente; PDF básico existente             | QR leído, formatos revisados y preview sin emisión                                                        | Por completar                                          |
| 3    | Pendiente; emisión GRE base existente       | Campos avanzados, QR oficial y PDF GRE                                                                    | Por completar                                          |
| 4    | Pendiente; infraestructura existente        | Reconciliación, entrega, scopes y ejemplos                                                                | Por completar                                          |
| 5    | Pendiente; sujeto a demanda                 | Documentos propios validados                                                                              | Por completar                                          |
| 6    | Opcional                                    | Necesidad confirmada y criterios de cada extensión                                                        | Por completar                                          |
