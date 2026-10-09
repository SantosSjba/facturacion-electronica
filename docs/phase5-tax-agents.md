# Fase 5: retención, percepción y reversión

Implementación del 2026-10-08. Migración aditiva `0018_tax_agent` aplicada en PostgreSQL local. Los comprobantes independientes **20/40** no son los ajustes de retención/percepción incluidos en una factura de la fase 1.

## Habilitación y transporte

Por defecto todas las empresas tienen `tax_agent_settings: { "retention": false, "perception_regimes": [] }`. Configurar desde Empresa → Información general o `PATCH /v1/companies/{id}`, con `companies:write`. El operador debe verificar la designación y elegibilidad de las operaciones ante SUNAT; esta configuración no consulta el padrón ni otorga la condición de agente. Crear series mediante `POST /v1/companies/{id}/series`: tipo `20`, serie `R001`; tipo `40`, serie `P001`. El RR usa serie de fecha y correlative automático, sin reutilizar números de originales.

`SUNAT_AGENT_MODE=fake` solo admite empresas sandbox. `real` solo admite producción y utiliza el servicio publicado para otros CPE: `https://e-factura.sunat.gob.pe/ol-ti-itemision-otroscpe-gem/billService?wsdl`. No utiliza el endpoint beta de facturas. Requiere certificado de firma válido y credenciales SOL del emisor. [Servicios web de SUNAT](https://orientacion.sunat.gob.pe/guias-manuales-y-servicios-web).

## Rutas y contratos

| Operación                      | Ruta                                            | Scope             |
| ------------------------------ | ----------------------------------------------- | ----------------- |
| Emitir retención 20            | `POST /v1/retentions`                           | `documents:write` |
| Emitir percepción 40           | `POST /v1/perceptions`                          | `documents:write` |
| Enviar reversión RR            | `POST /v1/reversions`                           | `documents:write` |
| Reconciliar RR                 | `POST /v1/reversions/{id}/reconcile-ticket`     | `documents:write` |
| Listar/consultar               | `GET /v1/documents[/{id}]`                      | `documents:read`  |
| XML, CDR ZIP, PDF, QR, eventos | `GET /v1/documents/{id}/{xml,cdr,pdf,qr,trace}` | `documents:read`  |

Los tres POST de emisión requieren `Idempotency-Key`. Igual clave/cuerpo devuelve el mismo documento; cambiar el cuerpo devuelve 409. Los contratos estrictos están publicados en OpenAPI. Aislamiento por organización y ambiente de API key, cuotas, firma y almacenamiento privado en MinIO reutilizan el flujo existente. Hay métodos SDK `retentions.create`, `perceptions.create`, `reversions.create` y `reversions.reconcileTicket`.

### Retención y percepción

Enviar `company_id`, `serie`, `issue_date`, cliente/proveedor con RUC válido (`identity_type: "6"`), `regime`, y `documents`. Cada documento incluye tipo, serie/número, fecha, moneda, importe total y pagos/cobros. Cada pago tiene número único, fecha e importe **antes** de descontar retención o agregar percepción.

Retención admite referencias 01/08/12. Percepción agrega 03. Una NC se declara en `credit_notes` del documento que disminuye: serie/número, fecha e importe en la misma moneda. Se incorpora al XML como referencia 07 sin pago ni impuesto; reduce el saldo disponible y no se cuenta dos veces al repetirse en pagos parciales. No se admite cobrar/pagar una NC como si fuera una factura ni trasladarla a otro documento.

Se calculan en centavos con redondeo por pago: retención 01 = **3%**, neto = base − retención; percepción 01 = **2%**, 02 = **1%**, 03 = **0.5%**, cobro total = base + percepción. El régimen 03 exige `customer_is_perception_agent: true` y referencia 01/08 que sustenta crédito fiscal. Esta declaración tampoco sustituye la verificación del padrón. [Catálogos 22/23](https://www.sunat.gob.pe/legislacion/superin/2017/anexosV-318-2017.pdf), [condición para 0.5%](https://emprender.sunat.gob.pe/principales-impuestos/impuesto-general-las-ventas-igv/sistema-detracciones-percepciones-retenciones).

Moneda del comprobante y totales: PEN. Referencias: PEN/USD/EUR. Para moneda extranjera, cada pago exige `exchange_rate` de su fecha, origen coincidente, destino PEN y hasta seis decimales. La base se convierte a centavos PEN antes de calcular el impuesto. Fechas de pago/NC coherentes con referencia/emisión; impuestos que redondean a cero, duplicados, metadatos contradictorios y exceso de saldo se rechazan. `totals_mode: strict` exige `tax_amount`/`settlement_amount` por pago y totales globales coincidentes; importes opcionales enviados en modo auto también deben coincidir.

Los pagos se reservan en los snapshots fiscales persistidos, bajo bloqueo de la empresa. La consulta usa un índice parcial por empresa/tipo y separa el ambiente histórico. Rechazo con CDR o RR aceptado libera la reserva; envío fallido o ambiguo la conserva. No hay reenvío automático de un comprobante enviado ni reutilización de su numeración. No se administra cobranza: `collection_status` sigue siendo `not_managed`.

XML Retention/Perception UBL 2.0, firma digital, validación XSD oficial **antes** de persistir/encolar, ZIP de un único XML y `sendBill` con respuesta CDR. Se guarda hash del ruleset, etapas de validación y modo simulado. No se declara cobertura Excel/XSL de reglas SUNAT para estos tipos. PDF A4/A5/ticket con pagos, moneda, tipo de cambio, tasa, totales y NC; datos, formato y logo históricos. QR desde XML firmado: impuesto retenido/percibido como total y campo IGV vacío.

[Guía oficial de retención v1.2](https://orientacion.sunat.gob.pe/sites/default/files/inline-files/Guia_XML_Retencion_v1_2_0_0.pdf), [anexo CRE](https://www.sunat.gob.pe/legislacion/superin/2017/anexoXIII-117-2017.pdf), [anexo CPE y NC relacionadas](https://www.sunat.gob.pe/legislacion/superin/2017/anexoXIV-117-2017.pdf). El enlace de la guía de percepción en el índice SUNAT no estuvo disponible; su estructura se contrastó con el XSD oficial UBLPE-Perception y estos anexos. No se presenta como guía descargada.

### Reversión

El cuerpo RR requiere `document_type: "20" | "40"`, `reference_date` (emisión de originales), `issue_date` (generación), `communicated_on` (fecha en que el emisor comunicó electrónicamente la reversión al receptor), y documentos con UUID/motivo. Todos deben estar aceptados, pertenecer al mismo emisor/ambiente/tipo/fecha y no tener una reversión pendiente. El integrador realiza esa comunicación externa; registrar su fecha no envía un correo.

No se mezclan 20 y 40 en un RR. Un resumen nuevo incorpora las líneas del anterior aceptado para la misma fecha/tipo porque lo sustituye; otro RR sin resolver bloquea un reemplazo. Se conserva la relación `replaces_reversion_id`, los UUID afectados y razones. El plazo es siete días calendario desde la comunicación al receptor, no desde la emisión del original. El envío de 20/40 se controla dentro de siete días desde emisión. [R.S. 274-2015, artículo 43 incorporado y reglas de reversión](https://www.sunat.gob.pe/legislacion/superin/2015/274-2015.pdf), [anexo RR retención](https://www.sunat.gob.pe/legislacion/superin/2017/anexoXV-117-2017.pdf), [anexo RR percepción](https://www.sunat.gob.pe/legislacion/superin/2017/anexoXVI-117-2017.pdf).

Se genera `VoidedDocuments`, ID `RR-YYYYMMDD-N`, ZIP `RUC-RR-YYYYMMDD-N` con fecha de generación y máximo cinco dígitos. `sendSummary` devuelve ticket; `getStatus` devuelve CDR. Aceptar el CDR y aplicar sus efectos a todos los originales se hace en una transacción: estado interno `cancelled` y relación `reversion.status: reversed`, sin sobrescribir XML/CDR/PDF/número originales. Rechazo libera el bloqueo RR, conservando la aceptación y pagos originales. El PDF RR es informativo y no tiene QR tributario. [Anexo técnico de transporte](https://www.sunat.gob.pe/legislacion/superin/2019/anexoXIII-1-B-114-2019.pdf).

Ocho intentos de consulta con backoff; agotamiento conserva ticket y marca `reconciliation_required`. Máximo tres ciclos manuales sin volver a enviar. Un fallo al presentar RR sin ticket conocido exige revisión externa. No se inventa recuperación de CDR 20/40 por identificadores: el servicio confirmado es emisión y CDR síncrono. El CDR real debe corresponder al identificador y RUC enviados.

## Verificación y pendientes oficiales

Verificación local del 2026-10-08: compilación de los 15 paquetes y lint de los archivos modificados correctos. Pasan 48 pruebas específicas nuevas (21 canónico/UBL, 10 firma/XSD, 16 integración y 1 SDK), las 100 pruebas unitarias del API y las 49 pruebas de integración aisladas de las fases 0–5/logo. Regresiones de paquetes: UBL 95, validación 50, PDF 28, SOAP 21 y SDK 12 pruebas correctas. Los conteos se solapan: no deben sumarse como casos distintos.

La ejecución general del API no está completamente verde: 88 pruebas E2E pasan y 16 de `test/app.e2e-spec.ts` mantienen fallos previos relacionados con datos demo/cuotas, fixtures GRE antiguos y límites de login. No se modificó ni reinició la organización demo para ocultarlos. La evidencia de fase 5 utiliza una organización temporal aislada.

Pruebas reproducibles: `packages/sunat-ubl/src/phase5.test.ts`, `packages/sunat-validation/src/phase5.test.ts`, `packages/sdk/src/phase5.test.ts`, `apps/api/test/tax-agent-phase5.e2e-spec.ts`. Cubren tasas, conversión, strict, fechas, NC, límites, firma verificada, XSD válido/inválido, aislamiento, permisos, idempotencia, pagos concurrentes, saldo acumulado, rechazo/ambigüedad, RR acumulativo, conservación de originales, ticket agotado/reconciliación, identidad CDR y PDFs reales en cuatro formatos. PostgreSQL/Redis/MinIO son reales; SUNAT usa transporte controlado. Los fixtures se crean en una organización aislada y se limpian después.

QA de PDF: fixtures en `tmp/pdfs/phase5` (ignorados por Git), extracción de texto y revisión de páginas renderizadas, incluidos multipágina y ticket. Retención/percepción aceptadas reutilizan entregas de fase 4 y accesos revocables; documentos revertidos bloquean nuevas entregas/acceso a destinatarios.

**Pendiente:** aceptación SUNAT con emisor designado, certificado y SOL reales: probar 20, los regímenes 40 habilitados y RR/reconciliación, guardar CDR y contrastar consulta oficial. Fake y XSD no acreditan elegibilidad tributaria ni aceptación. Percepción excepcional con referencia 40 revertida y redondeos comerciales especiales no se admiten silenciosamente: requieren una extensión contractual específica y evidencia oficial antes de habilitarse.

## Ejemplo de uso

Los cuerpos reproducibles están en [retención](../examples/tax-agents/retention.json), [percepción](../examples/tax-agents/perception.json) y [RR](../examples/tax-agents/reversion.json). Sustituir UUID de empresa/documento y fechas antes de ejecutar.

```ts
await client.companies.update(companyId, {
  tax_agent_settings: { retention: true, perception_regimes: ["01"] },
});
await client.companies.createSeries(companyId, { document_type: "20", serie: "R001" });
const doc = await client.retentions.create(body, "pago-proveedor-20261008-1");
// La creación no es aceptación: consultar doc.links.self o recibir su webhook.
await client.documents.get(doc.id);
```
