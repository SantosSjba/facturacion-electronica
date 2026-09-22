import { z } from "zod";

import { invoiceCreateSchema } from "./invoice-create.schema";

/**
 * ReceiptCreate (boleta 03) — InvoiceCreate fields + summary flags; serie B###.
 */
export const receiptCreateSchema = invoiceCreateSchema
  .omit({ serie: true })
  .extend({
    serie: z.string().regex(/^[Bb][A-Za-z0-9]{3}$/),
    include_in_daily_summary: z.boolean().optional().default(true),
    send_individually: z.boolean().optional().default(false),
  })
  .strict();

export type ReceiptCreate = z.infer<typeof receiptCreateSchema>;
