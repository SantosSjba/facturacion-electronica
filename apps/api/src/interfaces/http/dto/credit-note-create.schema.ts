import { z } from "zod";
import {
  cpeOptionalFields,
  cpeTotalsInputSchema,
  invoiceLineInputSchema,
  partyCanonicalSchema,
} from "@factosys/sunat-ubl";

/**
 * CreditNoteCreate (07) — OpenAPI + dict 14.
 */
export const creditNoteCreateSchema = z
  .object({
    company_id: z.string().uuid(),
    serie: z.string().regex(/^[FfBb][A-Za-z0-9]{3}$/),
    number: z.number().int().positive().optional(),
    issue_date: z.iso.date(),
    ...cpeOptionalFields,
    currency: z.string().length(3),
    note_type: z.string().min(1),
    reason: z.string().min(1),
    affected_document: z.object({
      document_type: z.enum(["01", "03", "12"]),
      serie_number: z.string().min(3),
    }),
    customer: partyCanonicalSchema,
    lines: z.array(invoiceLineInputSchema).min(1),
    totals_mode: z.enum(["auto", "strict"]).optional(),
    totals: cpeTotalsInputSchema.optional(),
    include_in_daily_summary: z.boolean().optional(),
  })
  .strict();

export type CreditNoteCreate = z.infer<typeof creditNoteCreateSchema>;
