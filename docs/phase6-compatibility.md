# Fase 6 — Compatibilidad TXT y decisiones sobre extensiones

Fecha: 2026-10-09. TXT implementado y verificado localmente. Contingencia física y nuevas operaciones sectoriales pendientes de un caso concreto de cliente y de implementar/verificar su ciclo fiscal. Offline/reseller evaluados en el diseño separado indicado al final; no son capacidades comerciales habilitadas.

## F6-01. Factosys TXT v1

Caso de uso: integración solicitada en este proyecto para sistemas que producen archivos delimitados y reutilizan la API. No se ha identificado todavía un cliente comercial externo. El formato es propio de Factosys: no acepta automáticamente los archivos propietarios de NubeFact ni los TXT oficiales de PEI.

Las rutas existentes `/v1/invoices`, `/v1/receipts`, `/v1/credit-notes` y `/v1/debit-notes` aceptan `Content-Type: text/plain; charset=utf-8`. Respuesta JSON, API key, scope `documents:write`, aislamiento por organización, idempotencia, numeración del servidor, validación fiscal, firma, colas, tickets, artefactos y webhooks conservan el mismo flujo que JSON. No hay otro motor de cálculo ni endpoint de emisión paralelo. GRE, RC/RA y agentes tributarios continúan con JSON.

### Gramática y límites

- UTF-8 estricto; BOM inicial opcional. LF o CRLF; salto final opcional. Registros vacíos interiores inválidos.
- Primera fila exacta `FACTOSYS|1|01` (o `03`, `07`, `08`, según ruta). Una versión o tipo incompatible devuelve 422 antes de reservar correlativos.
- `FIELD|nombre_del_campo|valor_JSON`: un campo de la raíz del contrato JSON. Cada campo aparece como máximo una vez. Objetos y arrays comerciales conservan íntegramente el contrato JSON. Campos desconocidos son rechazados por su esquema estricto.
- `LINE|objeto_JSON`: una línea completa por fila; su orden se conserva. `FIELD|lines|...` es inválido.
- Se separan solamente los delimitadores de control iniciales. Un `|` dentro del valor no se escapa. Comillas, barra inversa y saltos de línea dentro de cadenas usan escapes JSON (`\"`, `\\`, `\n`, `\r`); no se admiten valores multilínea físicos.
- Números JSON con punto decimal, sin coma decimal ni separadores de miles. Identificadores, códigos y fechas son cadenas entre comillas: `"0101"`, `"PEN"`, `"2026-10-09"`. Importes, cantidades y porcentajes siguen los tipos y precisión del contrato JSON; no se convierten cadenas numéricas ni se calculan impuestos en el adaptador.
- Máximo 200 KiB de bytes UTF-8, 2000 registros incluyendo cabecera y 1000 líneas. Cuerpo HTTP excesivo: 413. UTF-8 inválido o charset distinto: 400. Estructura/validación TXT: 422 con `details[].path = rows.<fila física desde 1>.<campo canónico>`.
- Campos ausentes se indican en fila 1; validaciones fiscales con rutas de línea concreta se asocian a su fila. Errores agregados de `lines` o sin ruta concreta se indican en fila 1. Rechazo SUNAT/transporte conserva su código y mensaje oficial.

Ejemplo completo: [invoice.txt](../examples/phase6/invoice.txt). Sustituir `company_id`, serie, adquirente y fecha con datos de la empresa configurada. El ejemplo calcula base gravada 200, IGV 36 y pagadero 236.

```sh
curl "$FACTOSYS_URL/v1/invoices" \
  -H "Authorization: Bearer $FACTOSYS_API_KEY" \
  -H "Idempotency-Key: legacy-sale-1001" \
  -H "Content-Type: text/plain; charset=utf-8" \
  --data-binary @examples/phase6/invoice.txt
```

SDK interno:

```ts
import { FactosysClient, encodeCpeTxt } from "@factosys/sdk";
const client = new FactosysClient({ apiKey, baseUrl });
const text = encodeCpeTxt("01", invoiceInput);
const document = await client.txt.create("01", text, "legacy-sale-1001");
```

TXT y JSON equivalentes, en la misma ruta y empresa con la misma clave, generan el mismo hash del cuerpo normalizado y reutilizan la respuesta. Modificar el contenido con la misma clave produce el conflicto existente. El adaptador no normaliza diferencias semánticas adicionales que el contrato JSON tampoco normaliza. Una respuesta 201 indica registro/emisión en proceso; consultar el documento o esperar el webhook para conocer aceptación.

### Evidencia local

- `cpe-input.pipe.test.ts`: escenarios comerciales de fase 1 producen cuerpos normalizados, hashes, totales y XML idénticos; boleta y ambas notas usan sus propios esquemas. Unicode, pipes, escapes, BOM/CRLF, duplicados, campos desconocidos/reservados, versiones, límites y localización de validación fiscal.
- `body-parsers.test.ts`: transporte HTTP TXT/JSON equivalente, tamaño/UTF-8 y regresión de parsers JSON existentes de login/preview.
- `packages/sdk/src/phase6.test.ts`: envío de bytes TXT sin codificación JSON, autenticación, idempotencia y rutas 01/03/07/08.
- `txt-idempotency.test.ts`: controlador de factura existente reutiliza una emisión JSON al recibir su equivalente TXT; contenido cambiado devuelve 409 y ausencia de clave devuelve 422, sin ejecutar una segunda emisión. Backend de idempotencia controlado en la prueba.
- OpenAPI publica ambos tipos de contenido; `/v1/capabilities` publica versión, tipos, límites y extensiones no habilitadas.

Estas pruebas verifican el adaptador y el motor local. No constituyen una aceptación nueva en SUNAT ni certifican una integración NubeFact.

Resultado de verificación: 114 pruebas de la suite unitaria API más la prueba añadida del controlador (115 casos distintos), 13 pruebas del SDK y repetición de los 15 casos afectados aprobadas. Build API/SDK, lint de los archivos TypeScript modificados y `git diff --check` aprobados. No se ejecutaron emisiones reales ni migraciones de base de datos.

## F6-02/F6-03. Criterio de habilitación

SUNAT establece obligaciones y contratos según operación y régimen; no recomienda que una API active todos los módulos del mercado. Se consultaron sus fuentes oficiales el 2026-10-09:

- [Procedimiento de contingencia/concurrencia](https://cpe.sunat.gob.pe/informacion_general/procedimiento_contingencia): la emisión física requiere informar comprobantes impresos. El procedimiento no equivale a enviar una factura electrónica con serie numérica.
- [Guía del resumen de comprobantes impresos](https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia_resumen_de_contingencia_0.pdf) y [PEI](https://www.gob.pe/27257-acceder-al-programa-de-envio-de-informacion-pei): sirven para definir el futuro canal de comunicación, sujeto al régimen del contribuyente y al contrato vigente.
- [Exportación de bienes y servicios](https://orientacion.sunat.gob.pe/11-exportacion-de-bienes-y-servicios): requisitos propios de operaciones con no domiciliados; tener cliente extranjero no basta para habilitar automáticamente un beneficio sectorial.

Decisión para el MVP ante la ausencia de cliente/escenario identificado: conservar la exportación y detracciones generales ya documentadas en fase 1; no añadir códigos de Tax Free, selva o detracciones especializadas ni presentar contingencia física como emisión soportada. Las series electrónicas F/B y su validación permanecen intactas.

Para habilitar una extensión: identificar RUC/régimen/caso comercial; revisar fuente oficial y catálogos vigentes; implementar contrato, canónico, cálculo, XML/firma, comunicación/consulta, persistencia, PDF/SDK; fixtures positivos/negativos y evidencia oficial cuando corresponda. El checklist de fase 6 permanece abierto para esas tareas.

## F6-04. Offline/reseller

Diseño y evaluación: [phase6-optional-design.md](./phase6-optional-design.md). Evaluación completada; implementación diferida por ausencia de demanda, no ofrecida como capacidad offline.
