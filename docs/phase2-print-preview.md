# Fase 2 — representación impresa y vistas previas

Implementada el 8 de octubre de 2026. Alcance: CPE 01/03/07/08; PDF informativo de RC/RA. GRE conserva su alcance para Fase 3.

## Formatos y conservación histórica

- `A4`, `A5`, `TICKET80`, `TICKET58`. Tickets con ancho físico de 80/58 mm y páginas de 297 mm para documentos extensos.
- En **Empresas → detalle → Información general → Formato de impresión**, se configura el formato predeterminado. También se admite `pdf_format` en `POST /companies` y `PATCH /companies/:id`, con permiso `companies:write` y JWT del panel.
- El integrador puede incluir `pdf_format` en el payload de factura, boleta o nota para sustituir el predeterminado **al emitir**.
- Se persiste `payload._print = { format, template_version: "ri-v2" }` junto con el modelo fiscal `_canonical` y el logo de emisión. La respuesta pública expone `printing`.
- Descargar `GET /v1/documents/:id/pdf` devuelve el PDF histórico de MinIO. Cambiar la empresa, su logo o su formato no reemplaza ese PDF. Una transacción con bloqueo del documento conserva el primer render incluso entre API y workers concurrentes.
- Solo los stubs que contienen `Factosys RI Fake PDF` pueden sustituirse al pasar a Playwright. Un documento antiguo sin `_print` usa la plantilla actual en su **primer** render; su PDF ya almacenado se conserva.
- `PDF_RI_MODE=playwright` genera los documentos completos. El modo `fake` sigue siendo un stub de pruebas. La plantilla rechaza versiones desconocidas: al introducir otra versión deben mantenerse los renderizadores de las versiones anteriores para documentos aún no renderizados.

## Datos y QR

El PDF usa el modelo fiscal persistido para emisor/adquirente, direcciones, productos, todas las líneas, tributos, ajustes, anticipos, detracción, cuotas, moneda, compra, vencimiento, leyendas y notas con motivo/documento afectado. Los precios unitarios usan el mismo formateador y precisión decimal del XML. `observations`, hasta 2.000 caracteres, se conserva en el modelo y en `cbc:Note`, y se imprime con escape HTML.

El QR toma RUC, tipo, serie/número, IGV, importe, fecha y adquirente del **XML firmado**, además de `DigestValue`. Respeta el correlativo tal como aparece en el XML. La estructura es:

```text
RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_ADQUIRENTE|DOC_ADQUIRENTE|DIGEST_VALUE
```

Referencia oficial: [SUNAT, Anexo A de la RS 113-2018, Anexo 6, §6.4](https://www.sunat.gob.pe/legislacion/superin/2018/anexoA-113-2018.pdf). QR normal, corrección Q, UTF-8, negro sobre blanco, módulo mínimo de 0,190 mm, margen blanco mínimo de 1 mm y tamaño máximo de 60 × 60 mm. Se utiliza 35 mm para el CPE habitual, ajustando tamaño/margen para payloads mayores. La especificación QR incluye valor resumen; el campo adicional `SignatureValue` pertenece al formato PDF417, no a esta estructura QR.

Con scope `documents:read` o el permiso equivalente del JWT:

| Ruta                           | Respuesta                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GET /v1/documents/:id/qr`     | JSON con `payload`, `data_url` PNG, `size_mm`, `modules`, `module_mm`, `quiet_zone_mm`, `error_correction` |
| `GET /v1/documents/:id/qr.png` | Imagen PNG para representación propia                                                                      |
| `GET /v1/documents/:id/pdf`    | PDF almacenado o primer render                                                                             |

El QR PNG se genera bajo demanda; el PDF y el XML firmado se guardan en MinIO. Las rutas comprueban pertenencia a la organización antes de leer archivos. RC/RA no ofrecen un QR CPE.

## Prevalidación y preview

Scope `documents:write` o permiso equivalente del JWT. No requiere `Idempotency-Key` ni certificado.

| Ruta POST               | Resultado                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/previews/validate` | Totales calculados, `preview: true`, `signed: false`, `sent_to_sunat: false`, `numbering_reserved: false`, `reference_number: 1` |
| `/v1/previews/xml`      | XML **sin firma**, con número 1 referencial y sin reserva de numeración                                                          |
| `/v1/previews/pdf`      | PDF con marca **VISTA PREVIA — SIN VALIDEZ TRIBUTARIA**, sin QR ni digest definitivo                                             |

Las tres rutas reciben el mismo envoltorio. `document` usa exactamente el contrato de emisión correspondiente:

```json
{
  "document_type": "01",
  "document": {
    "company_id": "00000000-0000-4000-8000-000000000001",
    "serie": "F001",
    "operation_type": "0101",
    "issue_date": "2026-10-08",
    "currency": "PEN",
    "totals_mode": "auto",
    "pdf_format": "TICKET80",
    "customer": { "identity_type": "6", "identity_number": "20123456789", "name": "ACME SAC" },
    "lines": [
      {
        "id": 1,
        "quantity": 1,
        "unit_code": "NIU",
        "description": "Servicio",
        "unit_value": 100,
        "tax_affectation": "10",
        "igv_percent": 18
      }
    ]
  }
}
```

Límites: 500 líneas y 200.000 bytes de JSON; cuerpos HTTP por encima de 200 KB se rechazan antes del controlador. Máximo de dos renders simultáneos por organización y cuatro por proceso; saturación devuelve 429 y `Retry-After`. Se aplica también el rate limit existente de API keys. La generación PDF tiene timeout de 30 s por operación Chromium.

Se reutilizan el cálculo y reglas de emisión, los constructores UBL y el armado del PDF. Las notas verifican el comprobante aceptado, moneda/adquirente, fecha, familia de serie y límite del importe; los anticipos verifican sus referencias y disponibilidad mediante lecturas. Preview no escribe documentos, eventos, artefactos ni numeración; no firma ni encola/envía. La validación reportada es `local_business_rules`; **no equivale a aceptación SUNAT** ni promete ejecutar el XSL oficial como parte de la petición.

XML/PDF incluyen `X-Factosys-Preview: true` y `Cache-Control: no-store`. Las notas necesitan una referencia aceptada existente, igual que al emitir. Omitir `number`: el número 1 del preview es referencial, incluso si la serie ya tiene documentos.

## RC/RA

`GET /v1/documents/:id/pdf` admite resúmenes y bajas en A4, como **documentos informativos**, con comprobantes incluidos, operación/motivo, fecha de referencia, ticket y estado/código/mensaje al generar el PDF. No se presentan como facturas, no imprimen un total fiscal agregado ni QR CPE.

Los nuevos RC/RA guardan el mismo modelo usado para construir su XML y el logo de emisión. Para documentos anteriores sin `_canonical`, se recuperan los datos del XML firmado. El resultado mostrado corresponde al momento del primer render: consultar `GET /v1/documents/:id` y el CDR para conocer el resultado vigente; descargar el PDF histórico no lo actualiza.

## SDK y Swagger

Swagger incorpora los tres contratos de preview y los nuevos campos de emisión. SDK interno:

```ts
await client.previews.validate({ document_type: "01", document: invoice });
const xml = await client.previews.getXml({ document_type: "01", document: invoice });
const pdf = await client.previews.getPdf({ document_type: "01", document: invoice });
const qr = await client.documents.getQr(documentId);
const png = await client.documents.getQrImage(documentId);
```

Tipos exportados: `PreviewInput`, `PreviewValidation`, `CpeQr`; `InvoiceInput`/`ReceiptInput`/`NoteInput` incluyen `pdf_format` y `observations`.

## Verificación

Verificación reproducible de PDFs reales (requiere Chromium y Poppler):

```powershell
pnpm --filter @factosys/pdf-ri build
# Si Poppler no está en PATH, define PDFTOPPM_PATH con la ruta de pdftoppm.exe.
pnpm --filter @factosys/pdf-ri test:print
```

Si tu distribución no incluye `pdftotext`, define `PDFTEXT_PYTHON_PATH` con un Python que tenga `pypdf`. El script verifica dimensiones físicas, todas las líneas, decodifica el QR desde el PDF rasterizado y comprueba preview/notas. Guarda las muestras en una carpeta temporal e indica su ruta para revisión visual.

- Migración aditiva `0016_company_pdf_format` aplicada en la base local.
- Decodificación del PNG y lectura de campos desde XML para 01/03/07/08; recuperación de RC/RA antiguos.
- PDFs de 100 líneas: A4 (4 páginas), A5 (8), 80 mm (7), 58 mm (9); comprobada la última línea por extracción de texto, revisión visual y lectura del QR desde la última página rasterizada a 200 dpi.
- Preview y nota revisados visualmente: marca visible y referencia/motivo respectivamente.
- HTTP aislado con Postgres/MinIO y certificado generado **solo de prueba**: autenticación/scopes, otra organización, límites, preview sin cambios de filas/series/eventos/artefactos/firma/colas, formatos, QR definitivo, RC/RA y carrera entre dos renders.
- Observaciones en 01/03/07/08 pasan XSD y reglas fiscales locales; factura firmada con observaciones pasa el XSL local disponible.
- Continúa pendiente la aceptación real SUNAT con certificado válido y el catálogo local del XSL para anticipos con ISC indicado en Fase 1. Esta fase no realiza envíos fiscales reales.
