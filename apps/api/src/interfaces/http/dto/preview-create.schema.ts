import { z } from "zod";
import { invoiceCreateSchema } from "./invoice-create.schema";
import { receiptCreateSchema } from "./receipt-create.schema";
import { creditNoteCreateSchema } from "./credit-note-create.schema";
import { debitNoteCreateSchema } from "./debit-note-create.schema";

export const previewCreateSchema = z.discriminatedUnion("document_type", [
  z.object({ document_type: z.literal("01"), document: invoiceCreateSchema }).strict(),
  z.object({ document_type: z.literal("03"), document: receiptCreateSchema }).strict(),
  z.object({ document_type: z.literal("07"), document: creditNoteCreateSchema }).strict(),
  z.object({ document_type: z.literal("08"), document: debitNoteCreateSchema }).strict(),
]);
export type PreviewCreate = z.infer<typeof previewCreateSchema>;
