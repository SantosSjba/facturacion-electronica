import { z } from "zod";
import {
  cpeOptionalFields,
  commercialFields,
  cpeTotalsInputSchema,
  invoiceLineInputSchema,
  partyCanonicalSchema,
} from "@factosys/sunat-ubl";

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
    issue_date: z.iso.date(),
    ...cpeOptionalFields,
    ...commercialFields,
    currency: z.string().length(3),
    totals_mode: z.enum(["auto", "strict"]).optional(),
    customer: partyCanonicalSchema,
    lines: z.array(invoiceLineInputSchema).min(1),
    totals: cpeTotalsInputSchema.optional(),
  })
  .strict();

export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
