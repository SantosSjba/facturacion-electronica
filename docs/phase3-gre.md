# Fase 3: guías de remisión 09 y 31

Implementada sobre el flujo GRE existente: firma, envío REST, ticket, consulta asíncrona y almacenamiento en MinIO. La numeración sigue siendo automática. No se envían documentos reales en las pruebas.

## Contrato y validación

`POST /v1/despatch-advices`, scope `documents:write`, requiere `Idempotency-Key`. No admite `number` ni campos desconocidos. Se comprueba pertenencia de la empresa antes de reservar idempotencia. Las reglas compartidas y los datos de la empresa se validan antes de cargar el certificado o reservar correlativo. El XML pasa el XSD UBL antes de firmarse y enviarse. Preparar el caché con `pnpm sunat:unpack-schemas` al instalar/desplegar.

Campos incorporados o corregidos:

- `shipment.handover_date`: entrega al transportista, obligatoria en 09 público. `start_date` conserva su significado de inicio del traslado. Fecha de emisión ≤ entrega ≤ inicio; fechas de calendario y horas reales.
- `vehicles`: primero principal, hasta dos secundarios en `AttachedTransportEquipment`. `tuc` identifica la TUC/habilitación; `authority_code` necesita `authority_entity_code`, y representa autorización especial, no TUC.
- `drivers`: primero principal, resto secundarios; se genera `JobTitle`. `name` contiene nombres y `last_name` apellidos, separados. Licencias obligatorias cuando se registran conductores. Se rechazan duplicados y roles que contradicen la posición.
- `carrier.mtc_registration` y `carrier.authorization` para 09 público. En 31 el transportista es la empresa emisora y se usan `shipment.mtc_registration` y `shipment.authorization`.
- Indicadores booleanos: `scheduled_transshipment`, `vehicle_m1_l`, `return_empty_vehicle`, `return_empty_packaging`, `register_carrier_transport`, `total_customs_transfer`, `total_goods_transfer`, `manifest_container_transfer`, `subcontracted`. Se emiten únicamente los verdaderos; se validan incompatibilidades y tipo de guía. El identificador oficial de subcontratación contiene la grafía `Trasporte`.
- En 09 público, registrar vehículos/conductores necesita `register_carrier_transport`, excepto la placa principal M1/L. M1/L no permite conductores, secundarios ni habilitación/autorización del vehículo. En privado se requiere vehículo y conductor, salvo M1/L.
- En 31, `freight_payer` es obligatorio: `shipper`, `subcontractor` o `third_party`. Subcontratación requiere `subcontractor` con RUC distinto del emisor. El tercero se identifica en `freight_payer_party`; el pagador subcontratador requiere subcontratación.
- Motivos del catálogo 20; `13` requiere descripción. Traslado entre establecimientos exige códigos de ambos puntos y RUC del emisor. Ubigeo de seis dígitos; código de establecimiento de cuatro, acompañado de `establishment_ruc`.
- Peso en `KGM`/`TNE`, hasta tres decimales; bultos positivos enteros. Cantidades de bienes con hasta diez decimales, sin redondeo silencioso a tres.
- Múltiples `related_documents`, con descripción y emisor tipados. En 31, más de un documento requiere una GRE electrónica o por evento entre las referencias. CPE/guías relacionadas requieren identidad del emisor. DAM/DS `50`/`52` con formato `aduana-año-régimen-correlativo`. Importación/exportación necesita DAM/DS; motivo 19 permite también manifiesto/orden del terminal.
- Ítems: `tariff_heading`, `normalized_good`, `customs_document_number`, `customs_item_number`. Los bienes normalizados requieren partida y código de producto SUNAT salvo traslado total aduanero; SUNAT verifica sus catálogos. La referencia DAM/DS por ítem aplica a 09 y debe coincidir con un documento relacionado; exportación parcial requiere esa referencia. En 31 DAM/DS se informa como documento relacionado. Las propiedades corresponden a 7020–7023.
- Contenedores `containers: [{ id, seal }]` o `container_id`/`container_seal`; puerto, peso de ítems seleccionados y sustento de diferencia de peso. Se conservan en XML/PDF. Contenedores aduaneros requieren precinto según motivo/indicador.

Las reglas locales cubren el contrato implementado. SUNAT mantiene verificaciones externas de RUC, habilitación, licencias, establecimientos y declaraciones aduaneras; pasar el XSD y estas reglas no acredita aceptación fiscal.

## Ejemplo: remitente público

```json
{
  "company_id": "00000000-0000-4000-8000-000000000001",
  "document_type": "09",
  "serie": "T001",
  "issue_date": "2026-10-08",
  "delivery_customer": {
    "identity_type": "6",
    "identity_number": "20123456789",
    "name": "DESTINATARIO SAC"
  },
  "shipment": {
    "transfer_reason_code": "01",
    "transport_mode_code": "01",
    "gross_weight": 125.125,
    "gross_weight_unit": "KGM",
    "total_packages": 20,
    "handover_date": "2026-10-09",
    "start_date": "2026-10-10",
    "carrier": {
      "identity_type": "6",
      "identity_number": "20600000000",
      "name": "TRANSPORTISTA SAC",
      "mtc_registration": "MTC123"
    },
    "origin": { "ubigeo": "150101", "address": "Av. Origen 123" },
    "destination": { "ubigeo": "040101", "address": "Almacén destino 456" }
  },
  "lines": [{ "id": 1, "quantity": 12.5, "unit_code": "NIU", "description": "Bienes a trasladar" }]
}
```

Para privado, `transport_mode_code: "02"`; omitir `carrier` y `handover_date`, e informar vehículos y conductores. Para 31, usar `V001`, identificar `shipper`, omitir campos específicos de 09, e incluir vehículos, conductores y `freight_payer`. Ejemplos ejecutables público/privado/M1-L/transportista/exportación en `packages/sunat-ubl/test-fixtures/gre-scenarios.ts`.

## CDR, QR y PDF

El REST oficial distingue `codRespuesta` 98 (procesando), 99 (envío con error) y 0 (envío OK). **99 no es aceptación con observación.** Con CDR se usa su `ResponseCode`; notas de un CDR con código 0 producen `accepted_with_observation`. El 99 REST permanece rechazado. Sin CDR, un ticket OK sigue pendiente de consulta.

El worker almacena el ZIP del CDR y extrae la URL del QR de `DocumentDescription`, sin fabricar un payload de factura. Antes de aceptar un CDR real comprueba serie/número y RUC receptor frente a la guía emitida. Rechaza XML con DTD/entidades y limita tamaño de extracción. Solo acepta URLs HTTPS del dominio SUNAT. El modo fake se marca `simulated: true` y nunca habilita un QR/PDF definitivo.

`GET /v1/documents/:id` incorpora `gre`:

```json
{
  "qr_status": "pending",
  "pdf_status": "pending",
  "cdr_status": "pending",
  "reconciliation_required": false,
  "simulated": false
}
```

`qr_status`/`pdf_status`: `pending`, `available` o `unavailable` cuando hubo rechazo. `cdr_status` distingue CDR disponible, pendiente o rechazo sin CDR. Una guía histórica sin `_canonical` declara `pdf_status: historical_snapshot_missing`; no se reconstruye con datos actuales de la empresa.

`GET /v1/documents/:id/qr`, `/qr.png` y `/pdf` requieren aceptación y URL del CDR. Mientras no existan responden 409 con detalles de disponibilidad. La URL está en `payload` interno; el QR público retorna `payload` y PNG igual que CPE, con contenido GRE. No se visita esa URL durante el render.

El PDF 09/31 usa datos históricos `_canonical`, configuración `_print` y `logoSnapshot`, con el objeto inmutable del logo en MinIO. Incluye bienes, cantidades, puntos, fechas, roles, licencias, habilitación, terceros, indicadores, contenedores y referencias. No imprime impuestos ni totales de factura. A4/A5/tickets 80/58 mm, paginación con cabeceras y QR. El primer PDF persistido conserva sus bytes.

## Duplicados, fallos y reconciliación

Un fallo previo a persistir permite liberar la reserva. Una guía persistida conserva su correlativo y trazabilidad; un fallo ambiguo de envío o 1033 no genera otro documento ni un reenvío automático. La emisión retorna el documento retenido con estado `failed` y `gre.reconciliation_required: true`; la misma clave de idempotencia reproduce ese documento. **201 significa registro local, no aceptación SUNAT.**

Las consultas usan ocho intentos con espera exponencial. Si se agotan, el estado sigue `ticket_pending` y se marca `reason: poll_exhausted`. No se afirma rechazo por un timeout.

Si se conoce el ticket oficial, `POST /v1/despatch-advices/:id/reconcile-ticket` con `{ "ticket": "UUID" }`, scope `documents:write`, retoma únicamente la consulta: hasta tres ciclos manuales, ocho intentos por ciclo. No cambia serie/número ni reenvía. Un ticket ya asignado no puede sustituirse. Se verifica el CDR antes de atribuir aceptación. Si el ticket se perdió, se necesita resolverlo con SUNAT; el manual publicado solo especifica envío y consulta por ticket, no recuperación por serie/número. No se inventa una consulta oficial.

## Baja GRE

GRE tiene tratamiento separado de RA/RC; estos endpoints CPE no anulan guías. La información oficial dirige las comunicaciones de conformidad/no conformidad a SEE-SOL y describe restricciones de baja cuando hay GRE por evento y cambios de destinatario. Revisar la guía en SUNAT Operaciones en Línea y realizar allí la baja que corresponda antes de emitir la nueva guía requerida para iniciar/reiniciar el traslado. La documentación REST revisada no publica una operación de baja GRE; esta fase no promete un endpoint para ella. Una baja realizada fuera de Factosys no cambia automáticamente nuestro estado local.

## SDK y comprobaciones

`client.despatchAdvices.create(body, idempotencyKey)` y `.reconcileTicket(id, ticket)`, con `DespatchInput`/`GreDocument` exportados. Recursos QR/PDF/CDR mediante `client.documents`. Swagger expone los nuevos campos y la petición de reconciliación.

Pruebas: cinco escenarios con XSD oficial; roles y condiciones fiscales; REST 98/99/0; CDR observado/rechazado, URL no confiable, otro documento y consulta agotada; integración HTTP con PostgreSQL/Redis/MinIO, firma con certificado de prueba, aislamiento de tenant, idempotencia, conservación de correlativo 1033 y logo histórico. `packages/pdf-ri/scripts/verify-gre-print.ts` comprueba 60 ítems en ocho PDFs (09/31 × cuatro formatos) y decodifica cada QR impreso. Requiere `PDFTOPPM_PATH` y `PDFTEXT_PYTHON_PATH`; deja artefactos de prueba en `tmp/pdfs/phase3`.

Pendiente externo: emisión y aceptación **real** SUNAT con certificado/credenciales habilitados y datos verificables de transporte/aduanas. Las respuestas CDR de las pruebas son fixtures, no aceptación real. El XSL CPE antiguo de anticipos con ISC sigue siendo el pendiente de Fase 1; estas pruebas GRE utilizan el XSD UBL y reglas compartidas.

## Fuentes oficiales

- [Sistemas GRE del contribuyente y documentos técnicos](https://cpe.sunat.gob.pe/node/116), consultado 08/10/2026.
- [Reglas GRE publicadas 25/09/2026](https://cpe.sunat.gob.pe/sites/default/files/2026-09/Reglas%20de%20validaci%C3%B3n%20publicado%20al%2025.09.2026.xlsx), hojas remitente/transportista y catálogos.
- [Manual URL GRE](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual%20URL%20%E2%80%93%20GRE.xlsx), hojas REST1 y REST2.
- [Manual de servicios GRE](<https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual_Servicios_GRE%20(1)_0.pdf>).
- [No conformidad y baja GRE](https://cpe.sunat.gob.pe/node/118).

Los dos XLSX y sus hashes se conservan en `docs/sunat-oficial/05-gre`. Son fuentes de consulta, no instrucciones de ejecución.
