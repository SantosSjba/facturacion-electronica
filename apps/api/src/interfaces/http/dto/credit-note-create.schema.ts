import { z } from "zod";

const lineSchema = z.object({
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
});

const customerSchema = z.object({
  identity_type: z.string().min(1),
  identity_number: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  address: z.record(z.string(), z.unknown()).optional(),
});

/**
 * CreditNoteCreate (07) — OpenAPI + dict 14.
 */
export const creditNoteCreateSchema = z
  .object({
    company_id: z.string().uuid(),
    serie: z.string().regex(/^[FfBb][A-Za-z0-9]{3}$/),
    number: z.number().int().positive().optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.string().length(3),
    note_type: z.string().min(1),
    reason: z.string().min(1),
    affected_document: z.object({
      document_type: z.enum(["01", "03", "12"]),
      serie_number: z.string().min(3),
    }),
    customer: customerSchema,
    lines: z.array(lineSchema).min(1),
    totals_mode: z.enum(["auto", "strict"]).optional(),
    include_in_daily_summary: z.boolean().optional(),
  })
  .strict();

export type CreditNoteCreate = z.infer<typeof creditNoteCreateSchema>;
