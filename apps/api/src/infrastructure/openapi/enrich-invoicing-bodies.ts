import { z } from "zod";
import type { OpenAPIObject } from "@nestjs/swagger";

import { creditNoteCreateSchema } from "../../interfaces/http/dto/credit-note-create.schema";
import { dailySummaryCreateSchema } from "../../interfaces/http/dto/daily-summary-create.schema";
import { debitNoteCreateSchema } from "../../interfaces/http/dto/debit-note-create.schema";
import { despatchAdviceCreateSchema } from "../../interfaces/http/dto/despatch-advice-create.schema";
import { invoiceCreateSchema } from "../../interfaces/http/dto/invoice-create.schema";
import { receiptCreateSchema } from "../../interfaces/http/dto/receipt-create.schema";
import { voidedDocumentCreateSchema } from "../../interfaces/http/dto/voided-document-create.schema";

const webhookCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).optional(),
  company_id: z.string().uuid().nullable().optional(),
});

const webhookPatchSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const validationCpeSchema = z.object({
  company_id: z.string().uuid(),
  ruc: z.string().length(11),
  document_type: z.string().min(2).max(2),
  serie: z.string().min(1),
  number: z.union([z.string().min(1), z.number().int().nonnegative()]),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: z.number(),
});

function zodToOpenApiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const REQUEST_BODIES: Array<{
  path: string;
  method: HttpMethod;
  schema: z.ZodType;
  required?: boolean;
  description: string;
  example?: Record<string, unknown>;
}> = [
  {
    path: "/v1/invoices",
    method: "post",
    schema: invoiceCreateSchema,
    description:
      "Datos de la factura (01). Requiere `company_id`, cliente, líneas y moneda. Con `totals_mode: auto` el backend calcula totales IGV.",
    example: {
      company_id: "00000000-0000-4000-8000-000000000001",
      serie: "F001",
      operation_type: "0101",
      issue_date: "2026-09-27",
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
          description: "Servicio de consultoría",
          unit_value: 100,
          unit_price: 118,
          tax_affectation: "10",
          igv_percent: 18,
          tax_scheme_id: "1000",
        },
      ],
    },
  },
  {
    path: "/v1/receipts",
    method: "post",
    schema: receiptCreateSchema,
    description:
      "Datos de la boleta (03). Misma estructura base que factura; serie suele ser B###.",
  },
  {
    path: "/v1/credit-notes",
    method: "post",
    schema: creditNoteCreateSchema,
    description:
      "Nota de crédito (07) referenciando el comprobante afectado (factura/boleta).",
  },
  {
    path: "/v1/debit-notes",
    method: "post",
    schema: debitNoteCreateSchema,
    description:
      "Nota de débito (08) referenciando el comprobante afectado.",
  },
  {
    path: "/v1/voided-documents",
    method: "post",
    schema: voidedDocumentCreateSchema,
    description:
      "Comunicación de baja (RA). Incluye los documentos a dar de baja y el motivo.",
  },
  {
    path: "/v1/daily-summaries",
    method: "post",
    schema: dailySummaryCreateSchema,
    description:
      "Resumen diario (RC). Puede agrupar boletas del día según reglas de pool.",
  },
  {
    path: "/v1/despatch-advices",
    method: "post",
    schema: despatchAdviceCreateSchema,
    description:
      "Guía de remisión electrónica (09/31). Requiere datos de traslado y destinatario.",
  },
  {
    path: "/v1/webhook-endpoints",
    method: "post",
    schema: webhookCreateSchema,
    description:
      "Registra una URL HTTPS que recibirá eventos. El `secret` se devuelve una sola vez.",
    example: {
      url: "https://example.com/webhooks/factosys",
      events: ["document.status_changed"],
    },
  },
  {
    path: "/v1/webhook-endpoints/{id}",
    method: "patch",
    schema: webhookPatchSchema,
    required: false,
    description: "Actualiza URL, eventos o estado (`active` / `disabled`).",
  },
  {
    path: "/v1/validations/cpe",
    method: "post",
    schema: validationCpeSchema,
    description:
      "Consulta validez de un CPE ante SUNAT (o Fake en sandbox). Incluye RUC, tipo, serie, número, fecha y monto.",
  },
];

/**
 * Nest + Zod pipes no emiten requestBody en OpenAPI automáticamente.
 * Adjunta JSON Schema (+ examples) para docs Scalar completas.
 */
export function enrichInvoicingRequestBodies(
  document: OpenAPIObject,
): OpenAPIObject {
  for (const entry of REQUEST_BODIES) {
    const pathItem = document.paths?.[entry.path];
    if (!pathItem) continue;
    const operation = pathItem[entry.method];
    if (!operation || typeof operation !== "object") continue;

    const schema = zodToOpenApiSchema(entry.schema);
    operation.requestBody = {
      required: entry.required !== false,
      description: entry.description,
      content: {
        "application/json": {
          schema,
          ...(entry.example ? { example: entry.example } : {}),
        },
      },
    };
  }
  return document;
}
