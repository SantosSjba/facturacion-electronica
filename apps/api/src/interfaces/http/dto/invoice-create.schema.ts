import { z } from "zod";

/**
 * InvoiceCreate — aligned to artifacts/schemas/invoice-create.schema.json + OpenAPI.
 * Invalid requests → 422 via ZodValidationPipe(schema, 422).
 */
export const invoiceCreateSchema = z
  .object({
    company_id: z.string().uuid(),
    serie: z.string().regex(/^[Ff][A-Za-z0-9]{3}$/),
    number: z.number().int().positive().optional(),
    operation_type: z.string().length(4),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    issue_time: z.string().optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currency: z.string().length(3),
    totals_mode: z.enum(["auto", "strict"]).optional(),
    purchase_order: z.string().optional(),
    customer: z.object({
      identity_type: z.string().min(1),
      identity_number: z.string().min(1),
      name: z.string().min(1),
      email: z.string().email().optional(),
      address: z.record(z.string(), z.unknown()).optional(),
    }),
    lines: z
      .array(
        z.object({
          id: z.number().int().positive(),
          quantity: z.number().positive(),
          unit_code: z.string().min(1),
          description: z.string().min(1),
          unit_value: z.number(),
          unit_price: z.number().optional(),
          tax_affectation: z.string().min(1),
          igv_percent: z.number().optional(),
          tax_scheme_id: z.string().optional(),
          product_code: z.string().optional(),
          sunat_product_code: z.string().optional(),
        }),
      )
      .min(1),
    legends: z
      .array(
        z.object({
          code: z.string(),
          text: z.string(),
        }),
      )
      .optional(),
    detraction: z.record(z.string(), z.unknown()).optional(),
    payment_means: z.array(z.record(z.string(), z.unknown())).optional(),
    totals: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
