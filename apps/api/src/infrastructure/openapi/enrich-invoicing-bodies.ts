import { z } from "zod";
import type { OpenAPIObject } from "@nestjs/swagger";

import { creditNoteCreateSchema } from "../../interfaces/http/dto/credit-note-create.schema";
import { dailySummaryCreateSchema } from "../../interfaces/http/dto/daily-summary-create.schema";
import { debitNoteCreateSchema } from "../../interfaces/http/dto/debit-note-create.schema";
import { despatchAdviceCreateSchema } from "../../interfaces/http/dto/despatch-advice-create.schema";
import { invoiceCreateSchema } from "../../interfaces/http/dto/invoice-create.schema";
import { receiptCreateSchema } from "../../interfaces/http/dto/receipt-create.schema";
import { voidedDocumentCreateSchema } from "../../interfaces/http/dto/voided-document-create.schema";

import { previewCreateSchema } from "../../interfaces/http/dto/preview-create.schema";
import {
  deliveryRequestSchema,
  deliveryRetrySchema,
  shareRequestSchema,
} from "../../interfaces/http/v1/document-integration.controller";
import {
  integratorCompanyCreateSchema,
  integratorCompanyPatchSchema,
  integratorSeriesCreateSchema,
  integratorSeriesPatchSchema,
  integratorSolSchema,
  integratorGreSchema,
} from "../../interfaces/http/companies/integrator-companies.controller";

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

const REQUEST_BODIES: {
  path: string;
  method: HttpMethod;
  schema: z.ZodType;
  required?: boolean;
  description: string;
  example?: Record<string, unknown>;
}[] = [
  {
    path: "/v1/documents/{id}/deliveries",
    method: "post",
    schema: deliveryRequestSchema,
    description:
      "Entrega solo tras aceptación. Idempotency-Key obligatorio; hasta diez correos. Estado propio por destinatario.",
  },
  {
    path: "/v1/documents/{id}/deliveries/{deliveryId}/retry",
    method: "post",
    schema: deliveryRetrySchema,
    description:
      "Autoriza reintento explícito de entrega fallida, desconocida o vencida; requiere motivo.",
  },
  {
    path: "/v1/documents/{id}/shares",
    method: "post",
    schema: shareRequestSchema,
    description:
      "Token limitado a un documento, máximo siete días; URL relativa, revocable. Archivos requieren aceptación.",
  },
  {
    path: "/v1/companies",
    method: "post",
    schema: integratorCompanyCreateSchema,
    description:
      "Onboarding por API, scope companies:write. RUC inmutable; series iniciales opcionales.",
  },
  {
    path: "/v1/companies/{id}",
    method: "patch",
    schema: integratorCompanyPatchSchema,
    description: "Configuración/desactivación de empresa sin borrar historial fiscal.",
  },
  {
    path: "/v1/companies/{id}/series",
    method: "post",
    schema: integratorSeriesCreateSchema,
    description: "Crear serie. Scope series:write. No reserva correlativo.",
  },
  {
    path: "/v1/companies/{id}/series/{seriesId}",
    method: "patch",
    schema: integratorSeriesPatchSchema,
    description: "Cambiar padding/estado, sin reiniciar contador.",
  },
  {
    path: "/v1/companies/{id}/sol-credentials",
    method: "put",
    schema: integratorSolSchema,
    description: "Credenciales SOL cifradas. username=RUC+usuario. Scope credentials:manage.",
  },
  {
    path: "/v1/companies/{id}/gre-credentials",
    method: "put",
    schema: integratorGreSchema,
    description: "Rotación cifrada de OAuth GRE. Invalida token cacheado.",
  },
  {
    path: "/v1/despatch-advices/{id}/reconcile-ticket",
    method: "post",
    schema: z.object({ ticket: z.string().uuid() }).strict(),
    description:
      "Reanuda consultarTicket de una GRE pendiente de reconciliación. Sin reenvío ni correlativo nuevo; máximo tres ciclos manuales. Se verifica identidad del CDR.",
  },
  ...["validate", "xml", "pdf"].map((output) => ({
    path: `/v1/previews/${output}`,
    method: "post" as const,
    schema: previewCreateSchema,
    description:
      "Vista previa CPE local sin certificado, envío ni reserva de correlativos; número 1 referencial. Scope documents:write; 500 líneas / 200 KB máximo. PDF marcado sin QR fiscal.",
  })),
  {
    path: "/v1/invoices",
    method: "post",
    schema: invoiceCreateSchema,
    description:
      "Factura (01) con múltiples líneas y totales por categoría/tributo/tasa. `auto` calcula los importes; `strict` requiere `totals` y compara exactamente a dos decimales. Se admiten direcciones tipadas, códigos de producto, leyendas, hora, vencimiento y orden de compra. Correlativo automático: omitir `number`. Crédito y cuotas, medios de pago, descuentos/cargos, anticipos, detracción 1001-1004, ISC (01/02/03), ICBPER, IVAP y tipo de cambio tipados. Ver docs/phase1-commercial-cpe.md.",
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
      "Boleta (03), serie B###, mismo contrato y totales auto/strict que factura. RC conserva gravadas/exoneradas/inafectas/gratuitas. RC en moneda distinta de PEN o exportación aún no soportado: usar envío individual.",
  },
  {
    path: "/v1/credit-notes",
    method: "post",
    schema: creditNoteCreateSchema,
    description:
      "Nota de crédito (07) con todas sus líneas, totales auto/strict y referencia al comprobante aceptado. Admite direcciones, códigos, hora, leyendas y orden de compra. Crédito tipo 13 ajusta cuotas de una factura a crédito aceptada con importes fiscales cero. Códigos 11/12 para exportación/IVAP. Descuentos y cargos tipados; misma moneda y adquirente del documento afectado.",
  },
  {
    path: "/v1/debit-notes",
    method: "post",
    schema: debitNoteCreateSchema,
    description:
      "Nota de débito (08) con todas sus líneas y totales auto/strict, referenciando el comprobante aceptado. Admite direcciones, códigos, hora, leyendas y orden de compra. Vencimiento aún no soportado.",
  },
  {
    path: "/v1/voided-documents",
    method: "post",
    schema: voidedDocumentCreateSchema,
    description: "Comunicación de baja (RA). Incluye los documentos a dar de baja y el motivo.",
  },
  {
    path: "/v1/daily-summaries",
    method: "post",
    schema: dailySummaryCreateSchema,
    description: "Resumen diario (RC). Puede agrupar boletas del día según reglas de pool.",
  },
  {
    path: "/v1/despatch-advices",
    method: "post",
    schema: despatchAdviceCreateSchema,
    description:
      "GRE 09/31 con roles de transporte, entrega e inicio del traslado, indicadores y referencias aduaneras. Numeración automática; 201 indica registro local. PDF/QR requieren aceptación y URL oficial del CDR. Consultar gre para disponibilidad y reconciliación.",
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
export function enrichInvoicingRequestBodies(document: OpenAPIObject): OpenAPIObject {
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
