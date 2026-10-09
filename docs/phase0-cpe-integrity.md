# Fase 0: integridad de CPE

> Las restricciones comerciales descritas aquí corresponden al cierre histórico de fase 0. Crédito, ajustes, anticipos, detracción y tributos adicionales se amplían en el [contrato de fase 1](./phase1-commercial-cpe.md).

Implementada el 2026-10-08 para factura 01, boleta 03, nota de crédito 07 y nota de débito 08. Se verificó localmente con XML firmado, XSD, reglas de importes, PostgreSQL, MinIO y PDF Chromium. Esta evidencia no equivale a aceptación de los nuevos escenarios en SUNAT real.

## Cálculo y redondeo

- El XML incluye todas las líneas, con IDs únicos. Cabecera y líneas usan su categoría, tributo y tasa propios; los subtotales se ordenan por tributo y tasa para producir XML determinista.
- Cantidad, valor y precio unitarios admiten hasta diez decimales. Se calcula con aritmética decimal entera, sin multiplicación monetaria binaria; se rechazan importes que excedan la precisión segura del modelo numérico.
- Se redondea half-up a dos decimales la base de cada línea (`cantidad * valor unitario`); el impuesto se calcula sobre esa base redondeada y se redondea a dos decimales. Cabeceras suman los importes de las líneas en centavos.
- `unit_price`, si se proporciona, debe coincidir a dos decimales con el valor unitario más su impuesto. Se conserva su precisión; si se omite, se deriva con hasta diez decimales. El total cobrable se obtiene de bases e impuestos por línea, no multiplicando un precio unitario redondeado.
- Gravadas, exoneradas, inafectas y exportaciones se distinguen. Las gratuitas usan tributo `9996`, categoría `Z`, precio de venta cero y precio referencial tipo `02`: `unit_value` representa el valor referencial unitario. Su base e impuesto referenciales no incrementan el importe que paga el cliente. Una operación gratuita requiere valor referencial positivo.
- `tax_amount` incluye el impuesto de líneas gratuitas; `free_tax_amount` lo identifica por separado. `tax_inclusive_amount` y `payable_amount` excluyen ese impuesto no cobrado. PDF y cadena QR usan el IGV cobrable, y muestran los importes gratuitos como referenciales.
- Se agrega la leyenda `1002` cuando todas las líneas son gratuitas, si el integrador no la envió.

Las reglas se contrastaron con los catálogos locales 05/07 y la [guía oficial de factura UBL 2.1](https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia%2Bxml%2Bfactura%2Bversion%202-1%2B1%2B0%20%282%29_0%20%282%29.pdf). Catálogos y tasas vigentes deben verificarse según fecha y escenario; validar contra XSD no demuestra cumplimiento de toda la normativa. Para clasificación de producto se consultó la [referencia oficial SUNAT](https://cpe.sunat.gob.pe/informacion_general/codigoproducto).

## Totales `auto` y `strict`

En `auto` (predeterminado), omitir `totals`. En `strict`, enviar obligatoriamente los cuatro importes siguientes:

```json
{
  "totals_mode": "strict",
  "totals": {
    "line_extension_amount": 200,
    "tax_amount": 36,
    "tax_inclusive_amount": 236,
    "payable_amount": 236
  }
}
```

Los importes deben ser números no negativos con hasta dos decimales y coincidir exactamente con el motor: tolerancia de comparación de totales **0.00**. No se sustituyen por los importes del integrador. Una diferencia produce `422 FACTOSYS_VALIDATION`, sin asignar correlativo ni enviar a SUNAT, e identifica el campo, por ejemplo `totals.payable_amount`.

Opcionalmente pueden verificarse `taxed_amount`, `exempt_amount`, `unaffected_amount`, `export_amount`, `free_amount` y `free_tax_amount`. Todos se devuelven calculados, junto con `tax_subtotals`. Los campos históricos `tax_category_id`, `tax_scheme_id` y `tax_scheme_name` conservan el tributo de un único grupo; con varios grupos contienen `MIXED`. Para operaciones mixtas, usar `tax_subtotals`.

## Inventario de campos y destino

La solicitud validada se conserva en `documents.payload`. Las nuevas emisiones añaden `_canonical`, un snapshot interno del modelo fiscal utilizado para el XML y el PDF, incluyendo dirección y nombre del emisor al emitir. El integrador no puede proporcionar ese campo. El hash de idempotencia continúa calculándose sobre la solicitud original.

| Campo                                                           | Destino y comportamiento                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `company_id`                                                    | Empresa autenticada; emisor, certificado y credenciales; persistencia y almacenamiento por organización.                                    |
| `serie`                                                         | Serie validada y familia de documento; XML, numeración, persistencia y PDF.                                                                 |
| `number`                                                        | No soportado como correlativo de entrada: devuelve 422. El servidor asigna el número; antes se aceptaba y se ignoraba.                      |
| `operation_type` (01/03)                                        | XML y snapshot; soporte explícito de venta interna `0101` y exportación `0200`. Otros tipos requieren ampliación fiscal y devuelven 422.    |
| `issue_date`, `issue_time`                                      | Fecha ISO real y hora `HH:mm:ss` válidas; XML, snapshot y PDF.                                                                              |
| `due_date`                                                      | Vencimiento en factura/boleta, XML y PDF; no puede preceder a emisión. En notas devuelve 422. No convierte una venta al contado en crédito. |
| `currency`                                                      | Moneda de importes en XML, persistencia y PDF. No se realiza conversión de moneda implícita.                                                |
| `purchase_order`                                                | `cac:OrderReference`, snapshot y PDF, también en notas.                                                                                     |
| `customer.identity_type`, `identity_number`, `name`             | Identificación/razón social en XML, columnas de consulta, snapshot y PDF.                                                                   |
| `customer.email`                                                | Contacto XML, snapshot y texto PDF; conservarlo no envía correo automáticamente.                                                            |
| `customer.address`                                              | Dirección tipada en XML y snapshot; línea/localidad en PDF.                                                                                 |
| `lines.id`, `quantity`, `unit_code`, `description`              | Todas las líneas del XML y snapshot; detalle de PDF. IDs duplicados se rechazan.                                                            |
| `lines.unit_value`, `unit_price`                                | Cálculo, precio/valor en XML, snapshot y PDF según reglas anteriores.                                                                       |
| `lines.tax_affectation`, `tax_scheme_id`, `igv_percent`         | Validación del par catálogos 07/05, categoría y cálculo propios de cada línea; XML, snapshot y PDF.                                         |
| `lines.product_code`                                            | `SellersItemIdentification`, snapshot y PDF.                                                                                                |
| `lines.sunat_product_code`                                      | UNSPSC de ocho dígitos en `CommodityClassification`, snapshot y PDF.                                                                        |
| `legends[].code`, `text`                                        | Nota XML con `languageLocaleID`, snapshot y PDF; texto escapado.                                                                            |
| `totals_mode`, `totals`                                         | Validación y cálculo descritos arriba; importes calculados en columnas, XML, snapshot y PDF.                                                |
| `detraction`, `payment_means` (01/03)                           | Devuelven 422 aunque sean objetos/arrays vacíos; pendientes de fase 1.                                                                      |
| `note_type`, `reason`, `affected_document` (07/08)              | Motivo y referencia XML, persistencia y PDF. El documento afectado debe estar aceptado. Ajuste de cuotas tipo 13 no soportado.              |
| `include_in_daily_summary` (03/07/08), `send_individually` (03) | Solicitud persistida y política existente de inclusión en RC; no son etiquetas del XML individual.                                          |

Dirección admitida:

```json
{
  "line": "Av. Ejemplo 123",
  "ubigeo": "150101",
  "department": "Lima",
  "province": "Lima",
  "district": "Lima",
  "urbanization": "Centro",
  "country_code": "PE",
  "establishment_code": "0000"
}
```

Los campos de dirección son opcionales; si se envían, deben cumplir el tipo/formato documentado. Las direcciones de empresas configuradas en el portal usan el mismo contrato al emitir. Datos inválidos requieren corregir la configuración; no se descartan silenciosamente.

Objetos de cliente, dirección, líneas y leyendas rechazan claves desconocidas. Descuentos, cargos, anticipos, ISC, ICBPER e IVAP completos siguen pendientes de fase 1; no incluir campos de esas capacidades en la solicitud esperando que tengan efecto. El par IVAP del catálogo se rechaza expresamente hasta completar su cálculo.

## Boletas y RC

El pool RC reutiliza las bases calculadas de gravadas, exoneradas, inafectas y gratuitas, en lugar de enviar toda la base como gravada. El impuesto no cobrado de gratuitas se separa del IGV cobrable. El builder RC ya dispone del importe de operaciones gratuitas.

RC para exportación o moneda distinta de PEN todavía no está implementado. Una boleta nueva en esos escenarios debe usar `send_individually: true`; solicitar su inclusión en RC devuelve 422. El pool también rechaza documentos históricos de esos escenarios para evitar cambiar su moneda o clasificarlos como gravados. Notas con inclusión explícita en RC siguen esta restricción.

## Historial, instalación y verificación

No se requiere migración: el snapshot usa la columna JSON de payload existente. Construir los paquetes UBL/PDF/validación y la API, y reiniciar los procesos que utilicen compilados anteriores. Los PDFs ya almacenados se conservan; documentos anteriores sin snapshot usan la ruta histórica de representación. Esta fase no corrige retroactivamente XML firmados ni documentos emitidos con el defecto anterior.

Pruebas relevantes:

- `packages/sunat-ubl/src/phase0.test.ts`: 1, 2 y 50 líneas, boleta/notas, impuestos mixtos, distintas tasas, gratuitas, decimal half-up, modo estricto y campos opcionales.
- `packages/sunat-validation/src/phase0.test.ts`: XSD y reglas locales para 01/03/07/08 con líneas mixtas y gratuitas; eliminación deliberada de una línea debe fallar.
- `apps/api/src/infrastructure/documents/cpe-phase0.test.ts`: DTO a XML firmado, conservación de datos y rechazo previo a asignar correlativo.
- `apps/api/src/infrastructure/documents/summary-pool.service.test.ts`: clasificación RC y límites explícitos de soporte.
- `apps/api/src/infrastructure/pdf/pdf.service.test.ts`: importes y direcciones desde snapshot fiscal y gratuidad sin cobro.
- `apps/api/test/cpe-phase0.e2e-spec.ts`: PostgreSQL y MinIO reales, numeración, snapshots, firma y PDFs Chromium de los cuatro tipos, con organización temporal que se elimina al terminar. Cola y respuesta SUNAT simuladas; no realiza emisión real.

La suite general basada en cuentas demo tuvo errores de permisos/plan y límites de peticiones (403/429), independientes de esta prueba aislada. Mantener esa limitación registrada; no reportar toda la suite general como aprobada. Para aceptación fiscal externa de los escenarios nuevos, continuar con el [checklist SUNAT](./checklist-sandbox-beta.md).

La compilación de los paquetes afectados pasó, al igual que ESLint sobre los archivos de implementación y pruebas propios de esta fase. El lint global mantiene errores previos en otros módulos y en la suite histórica; no se declara aprobado.
