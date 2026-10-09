# @factosys/sdk

Cliente TypeScript mínimo para la API Factosys (S9 / spec 17).

## Instalación (workspace)

```bash
pnpm add @factosys/sdk --filter <tu-app>
```

## Factura gravada (sandbox / Fake)

```ts
import { FactosysClient } from "@factosys/sdk";

const client = new FactosysClient({
  apiKey: process.env.FACTOSYS_API_KEY!,
  baseUrl: process.env.FACTOSYS_BASE_URL ?? "http://localhost:3000",
});

const doc = await client.createInvoiceAndWait(
  {
    company_id: process.env.FACTOSYS_COMPANY_ID,
    serie: "F001",
    operation_type: "0101",
    issue_date: "2026-09-17",
    currency: "PEN",
    totals_mode: "auto",
    customer: {
      identity_type: "6",
      identity_number: "20123456789",
      name: "ACME SAC",
    },
    lines: [
      {
        id: 1,
        quantity: 1,
        unit_code: "NIU",
        description: "Servicio",
        unit_value: 100,
        unit_price: 118,
        tax_affectation: "10",
        igv_percent: 18,
        tax_scheme_id: "1000",
      },
    ],
  },
  { idempotencyKey: `inv-${Date.now()}` },
);

console.log(doc.status, doc.serie_number, doc.links);
```

## Helpers

- `withIdempotencyKey(key)` — clona el client con header fijo
- `createInvoiceAndWait` — poll hasta estado terminal
- `verifyWebhookSignature(rawBody, headers, secret)` — ADR-004
- `isRetryable(error)` — usa `error.retryable`
- `getRuleset(baseUrl)` — `GET /meta/ruleset` público

## Errores tipados

| code                            | Clase                      |
| ------------------------------- | -------------------------- |
| `FACTOSYS_VALIDATION`           | `ValidationError`          |
| `FACTOSYS_SUNAT_REJECTED`       | `SunatRejectedError`       |
| `FACTOSYS_IDEMPOTENCY_CONFLICT` | `IdempotencyConflictError` |
| otros                           | `FactosysError`            |

Los códigos son estables para `switch` en el integrador (doc 16 / S9-02).

## Casos comerciales de fase 1

`invoices.create` y `receipts.create` reciben `InvoiceInput`/`ReceiptInput`; `creditNotes.create` y `debitNotes.create` reciben `NoteInput`. Los tipos comparten el contrato fiscal: cuotas, ajustes, anticipos, detracción, ISC, ICBPER, IVAP, referencias y cambio. Cada emisión requiere una clave de idempotencia estable para esa operación.

```ts
import { FactosysClient, type InvoiceInput } from "@factosys/sdk";
const client = new FactosysClient({ apiKey, baseUrl });
const input: InvoiceInput = {
  ...invoiceData,
  payment_terms: {
    condition: "credit",
    currency: "PEN",
    outstanding_amount: 118,
    installments: [
      { number: 1, due_date: "2026-11-08", amount: 50 },
      { number: 2, due_date: "2026-12-08", amount: 68 },
    ],
  },
};
const document = await client.invoices.create(input, operationId);
```

Ver [contrato y ejemplos](../../docs/phase1-commercial-cpe.md). El cambio se proporciona explícitamente y no convierte los precios del request. Las cuotas describen el crédito, no los pagos cobrados.
