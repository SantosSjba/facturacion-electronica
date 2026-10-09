# Fase 1: casos comerciales y fiscales

Implementación local: 2026-10-08. Amplía el [contrato de fase 0](./phase0-cpe-integrity.md). Los escenarios se conservan en DTO, cálculo decimal, snapshot `_canonical`, XML firmado y PDF histórico en MinIO. No requiere migración de base de datos. El cliente TypeScript y OpenAPI comparten las estructuras nuevas.

## Contrato y ejemplos

Usar `POST /v1/invoices` o `/v1/receipts`, con autorización y `Idempotency-Key` habituales. Omitir `number`: el servidor asigna el correlativo. Todos los importes del documento se expresan en `currency`; la detracción y los valores referenciales del transporte se expresan en PEN. Los ejemplos usan un UUID ilustrativo: sustituir empresa, adquirente, fechas, series y referencias por datos propios. Para anticipos, emitir primero el documento fuente y esperar su aceptación antes de regularizarlo.

| Caso                | Request                                                    | Resultado del ejemplo                              |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Crédito             | [Dos cuotas](./examples/phase1/credito-dos-cuotas.json)    | 118; cuotas 50 + 68                                |
| Ajustes             | [Línea y global](./examples/phase1/descuentos-cargos.json) | Base gravada 85; IGV 15.30; pagadero 105.30        |
| Anticipo            | [Parcial](./examples/phase1/anticipo-parcial.json)         | Bruto 118; anticipo 23.60; saldo 94.40             |
| Detracción habitual | [Servicio](./examples/phase1/detraccion.json)              | Documento 118; detracción 14 PEN                   |
| ICBPER              | [Bolsa](./examples/phase1/icbper.json)                     | IGV 18; ICBPER 0.50; total 118.50                  |
| ISC al valor        | [Sistema 01](./examples/phase1/isc-01.json)                | ISC 10; IGV 19.80; total 129.80                    |
| ISC específico      | [Sistema 02](./examples/phase1/isc-02.json)                | ISC 5; IGV 18.90; total 123.90                     |
| ISC precio público  | [Sistema 03](./examples/phase1/isc-03.json)                | ISC 12; IGV 20.16; total 132.16                    |
| IVAP                | [Arroz pilado](./examples/phase1/ivap.json)                | IVAP 4; total 104                                  |
| Exportación         | [USD y no domiciliado](./examples/phase1/exportacion.json) | Total 100 USD; metadatos de cambio y guía          |
| Hidrobiológicos     | [Operación 1002](./examples/phase1/hidrobiologicos.json)   | Embarcación, especie, descarga y toneladas         |
| Pasajeros           | [Operación 1003](./examples/phase1/pasajeros.json)         | Placa, fecha, origen y destino                     |
| Carga               | [Operación 1004](./examples/phase1/transporte-carga.json)  | Origen/destino, tramos y valores; detracción 8 PEN |
| Anticipo con ISC    | [Regularización](./examples/phase1/anticipo-isc.json)      | Bruto 129.80; anticipo 25.96; saldo 103.84         |

Ejemplos adicionales: [contado](./examples/phase1/contado.json), [nota de descuento](./examples/phase1/nota-descuento.json), [devolución](./examples/phase1/nota-devolucion.json), [corrección de cuotas](./examples/phase1/nota-cuotas.json) y [nota de débito](./examples/phase1/nota-debito.json).

### Forma y medio de pago

`payment_terms` admite `{ "condition": "cash" }` o crédito con `currency`, `outstanding_amount` e `installments`. Las cuotas se numeran desde 1, se ordenan por vencimiento posterior a la emisión, y su suma coincide exactamente con el saldo. `due_date`, cuando se proporciona, corresponde a la última cuota. El saldo es el pagadero menos detracción convertida explícitamente a la moneda del documento. La condición de pago no registra cobros ni cambia el estado SUNAT. `payment_means` conserva código del catálogo 59, cuenta, banco, referencia y vencimiento.

### Descuentos y cargos

`adjustments` existe en línea y cabecera. Cada ajuste incluye `code`, `base_amount`, `amount`, y opcionalmente `factor`, `reason` y selección fiscal. El factor, hasta cinco decimales, multiplicado por la base debe producir el importe a dos decimales. Se rechazan códigos fuera del ámbito y descuentos superiores a la base.

| Ámbito | Afectan base fiscal               | No afectan base fiscal             |
| ------ | --------------------------------- | ---------------------------------- |
| Línea  | Descuento 00, cargo 47            | Descuento 01, cargo 48             |
| Global | Descuento 02, cargo 49 (IGV/IVAP) | Descuento 03, propina 46, cargo 50 |

Los descuentos/cargos de línea modifican su base antes de calcular impuestos. Los globales modifican sus grupos y el valor de venta de cabecera, sin reescribir las líneas. `AllowanceTotalAmount` y `ChargeTotalAmount` reúnen los ajustes que no afectan la base, incluidos los de línea. Estos se aplican al pagadero después del precio fiscal `TaxInclusiveAmount`. Por ello el total pagadero puede diferir del precio fiscal. El precio unitario de venta refleja impuestos y ajustes de línea; `unit_value` mantiene el valor unitario anterior a esos ajustes. Los ajustes fiscales de anticipos 04/05/06/20 los genera el servidor; no se reciben como descuentos arbitrarios.

### Anticipos y concurrencia

`prepayments` referencia tipo, serie/número, RUC, fecha de pago, base, importe y categoría/tasa. Si tiene ISC también identifica sistema y tasa efectiva. Se verifica que el fuente sea aceptado, pertenezca a la misma empresa/organización, moneda y cliente, y contenga esa categoría fiscal. La fecha de pago no puede preceder su emisión ni superar la emisión regularizada. Referencias con distinto relleno de ceros se consideran el mismo documento.

La reserva se vuelve a comprobar dentro de la transacción de emisión, con bloqueo organizacional y del fuente. Dos solicitudes concurrentes no pueden consumir dos veces el mismo saldo. Documentos pendientes, aceptados y fallidos recuperables reservan el anticipo; rechazados o anulados lo liberan. La conciliación usa los payloads persistidos, conservando idempotencia y aislamiento existentes. Las bases e impuestos se regularizan; `PrepaidAmount` se descuenta una sola vez del bruto.

### Tributos y detracción

ISC admite valor porcentual (01), monto por unidad (02), o precio público × factor × tasa (03). Se calcula primero y forma parte de la base IGV de la línea cuando corresponde. El grupo IGV de cabecera presenta el valor de venta sin ISC, conforme a la regla SUNAT 3277; su impuesto reúne los importes de línea ajustados. En sistema 02 se conserva monto/unidad y se representa además la tasa efectiva que exige la validación fiscal. En sistema 03 la base ISC puede diferir del valor de venta.

ICBPER usa cantidad entera igual a la cantidad redondeada del ítem; usar una línea de bolsas separada cuando la cantidad difiera de la del producto. La tasa PEN sigue la fecha: 0.10 desde agosto de 2019, 0.20 en 2020, 0.30 en 2021, 0.40 en 2022 y 0.50 desde 2023. En moneda extranjera requiere cambio explícito. IVAP usa afectación 17, esquema 1016 y tasa 4%; no se mezcla con otras afectaciones ni ISC. Las gratuitas conservan referencia y tributos de línea no cobrables; el ISC gratuito se excluye del ISC de cabecera y el ICBPER sigue siendo cobrable. `free_tax_amount` informa los tributos de referencia no cobrados.

Detracción requiere operación 1001–1004, código del catálogo 54, tasa explícita, monto PEN redondeado a soles enteros, cuenta de 11 dígitos y medio del catálogo 59. El importe debe corresponder a la base calculada. Carga 1004 usa código 027 y tasa 4% sobre el mayor entre la operación y valor referencial; requiere origen/destino, viaje, referencia de carga/vehículo y tramos. Hidrobiológicos 1002 usa 004 y pasajeros 1003 usa 028, con datos específicos en todas sus líneas. Se conservan y muestran los datos en UBL/PDF. La selección de tasa y la procedencia de la detracción habitual dependen del servicio y emisor; el motor no decide obligaciones tributarias a partir de una descripción libre.

### Notas y documentos relacionados

`POST /v1/credit-notes` y `/v1/debit-notes` conservan ajustes, cuotas, medios, tipo de cambio y referencias a guías. El documento afectado debe estar aceptado y pertenecer a la empresa, cliente y moneda; la nota no puede precederlo. Motivos admitidos según catálogos 09/10 de las reglas 2026. Exportación requiere motivo 11 e IVAP motivo 12. Para crédito, 04/05 representan descuentos y 06/07 devoluciones; se usan líneas e importes del ajuste. Las notas de crédito no pueden superar el importe del original.

La nota de crédito 13 modifica saldo/cuotas de un documento emitido a crédito: requiere líneas de valor cero, cuotas coherentes y no modifica bases/impuestos. En notas de débito, 13 significa penalidades, no corrección de cuotas. Anticipos y detracción pertenecen a facturas/boletas; se rechazan en notas. Las referencias a guías admiten tipos 09 y 31. Un cliente no domiciliado debe identificar país extranjero.

`exchange_rate` exige moneda fuente igual a la moneda extranjera del CPE, destino PEN, tasa positiva, fecha no posterior a emisión y fuente. Se persiste y muestra en XML/PDF; no cambia automáticamente los precios recibidos. Solo se utiliza para conciliar detracción y la tasa ICBPER cuando es necesario.

### Resumen diario y errores

RC conserva gravadas, exoneradas, inafectas, gratuitas y grupos IGV/IVAP/ISC/ICBPER con sus tasas, además de cargos no fiscales. Las referencias de notas y cargos siguen el orden del XSD. Moneda extranjera, exportación, descuentos no fiscales y corrección de cuotas 13 requieren envío individual: el API responde 422 antes de consumir correlativo si se solicita RC. Los errores comerciales devuelven ruta del campo; DTOs anidados son tipados y estrictos.

## Verificación y límite oficial

La cobertura incluye cálculo positivo/negativo, XSD y reglas de consistencia para los 14 escenarios, notas con descuentos, crédito 13 y gratuidad con ISC/ICBPER. La integración aislada usa PostgreSQL, MinIO, firma con certificado efímero y Chromium reales; simula colas/SUNAT y elimina organización/artefactos de prueba. Comprueba facturas y boletas, PDF histórico, XML firmado, notas y consumo concurrente de anticipos. El XSD de resumen diario también se verificó.

Se ejecutó adicionalmente el XSL oficial local para las 14 facturas firmadas. Los escenarios 0–12 pasan; el anticipo ISC (13) encuentra el rechazo 3071 porque el catálogo 53 del paquete SFS local no contiene el código 20, aunque las reglas SUNAT del 26-08-2026 lo contemplan para anticipos ISC. No se alteró ese validador para obtener un pase artificial. El escenario tiene cobertura de fórmula, XSD y flujo local; falta renovar el paquete/catálogos oficiales y verificar aceptación real. Ningún resultado Fake significa aceptación SUNAT. El checklist de producción debe registrar CDR y observaciones oficiales para cada caso.

Fuentes primarias: [guías y reglas SUNAT](https://cpe.sunat.gob.pe/guias-y-manuales), [guía factura UBL 2.1](https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia%2Bxml%2Bfactura%2Bversion%202-1%2B1%2B0%20%282%29_0%20%282%29.pdf), [crédito/cuotas](https://www.sunat.gob.pe/legislacion/superin/2022/anexo-123-2022.pdf), [corrección de cuotas](https://www.sunat.gob.pe/legislacion/superin/2020/anexo4-193-2020.pdf), [IVAP](https://orientacion.sunat.gob.pe/3412-02-contribuyentes-base-imponible-y-tasa-del-impuesto), [ICBPER](https://orientacion.sunat.gob.pe/7282-03-monto), [ISC](https://orientacion.sunat.gob.pe/3119-05-calculo-del-impuesto-isc).

### Registro de comprobación local

- Compilación: API, UBL, validación, PDF y SDK con dependencias, sin errores.
- Pruebas automatizadas: 215 aprobadas en los paquetes afectados y las integraciones aisladas (65 UBL, 31 validación, 11 PDF, 7 SDK, 91 API y 10 de integración incluyendo regresión de logos/fase 0).
- ESLint de archivos TypeScript modificados y formato de archivos de esta fase, sin errores. `git diff HEAD --check` sin errores.
- Inspección visual de crédito, cargos, transporte y anticipos en Chromium; los datos comerciales quedan visibles sin recortes.
- XSL oficial local: 13 aprobados; anticipo ISC pendiente por catálogo 53 desactualizado (3071). XSD local del resumen diario aprobado.

Comandos de referencia:

```powershell
pnpm exec turbo run build --filter=@factosys/api --filter=@factosys/sunat-validation --filter=@factosys/pdf-ri --filter=@factosys/sdk
pnpm exec turbo run test --filter=@factosys/sunat-ubl --filter=@factosys/sunat-validation --filter=@factosys/pdf-ri --filter=@factosys/sdk
pnpm --filter @factosys/api exec vitest run --config vitest.config.ts
pnpm --filter @factosys/api exec vitest run --config vitest.e2e.config.ts test/cpe-phase0.e2e-spec.ts test/cpe-phase1.e2e-spec.ts test/company-logo.e2e-spec.ts
```

La suite general dependiente de datos demo y el lint global conservan las limitaciones previas registradas en fase 0; no se usaron para atribuir aceptación a estos escenarios aislados.
