import { z } from "zod";
import { invoiceCreateSchema } from "./invoice-create.schema";
import { receiptCreateSchema } from "./receipt-create.schema";
import { creditNoteCreateSchema } from "./credit-note-create.schema";
import { debitNoteCreateSchema } from "./debit-note-create.schema";
import { despatchAdviceCreateSchema } from "./despatch-advice-create.schema";
import { dailySummaryCreateSchema } from "./daily-summary-create.schema";
import { voidedDocumentCreateSchema } from "./voided-document-create.schema";
import {
  retentionCreateSchema,
  perceptionCreateSchema,
  reversionCreateSchema,
} from "../v1/tax-agents.controller";

export const previewCreateSchema = z.discriminatedUnion("document_type", [
  z.object({ document_type: z.literal("01"), document: invoiceCreateSchema }).strict(),
  z.object({ document_type: z.literal("03"), document: receiptCreateSchema }).strict(),
  z.object({ document_type: z.literal("07"), document: creditNoteCreateSchema }).strict(),
  z.object({ document_type: z.literal("08"), document: debitNoteCreateSchema }).strict(),
  z.object({ document_type: z.literal("09"), document: despatchAdviceCreateSchema }).strict(),
  z.object({ document_type: z.literal("31"), document: despatchAdviceCreateSchema }).strict(),
  z.object({ document_type: z.literal("RC"), document: dailySummaryCreateSchema }).strict(),
  z.object({ document_type: z.literal("RA"), document: voidedDocumentCreateSchema }).strict(),
  z.object({ document_type: z.literal("20"), document: retentionCreateSchema }).strict(),
  z.object({ document_type: z.literal("40"), document: perceptionCreateSchema }).strict(),
  z.object({ document_type: z.literal("RR"), document: reversionCreateSchema }).strict(),
]);
export type PreviewCreate = z.infer<typeof previewCreateSchema>;
export type CpePreviewCreate = Extract<PreviewCreate, { document_type: "01" | "03" | "07" | "08" }>;
export type AuxiliaryPreviewCreate = Exclude<PreviewCreate, CpePreviewCreate>;
