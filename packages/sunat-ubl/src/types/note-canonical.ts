import { z } from "zod";

import { ublValidationError } from "../errors";
import {
  invoiceLineCanonicalSchema,
  invoiceLineInputSchema,
  invoiceTotalsSchema,
  partyCanonicalSchema,
  type InvoiceLineCanonical,
  type InvoiceLineInput,
  type InvoiceTotals,
  type PartyCanonical,
} from "./invoice-canonical";

export const affectedDocumentSchema = z.object({
  document_type: z.enum(["01", "03", "12"]),
  serie_number: z.string().min(3),
});

export type AffectedDocument = z.infer<typeof affectedDocumentSchema>;

export const noteDocumentTypeSchema = z.enum(["07", "08"]);
export type NoteDocumentType = z.infer<typeof noteDocumentTypeSchema>;

/** Shared canonical for CreditNote (07) / DebitNote (08). */
export const noteCanonicalSchema = z
  .object({
    document_type: noteDocumentTypeSchema,
    serie: z.string().regex(/^[FfBb][A-Za-z0-9]{3}$/),
    number: z.number().int().positive(),
    issue_date: z.string().min(10),
    currency: z.string().length(3),
    note_type: z.string().min(1),
    reason: z.string().min(1),
    affected_document: affectedDocumentSchema,
    totals_mode: z.enum(["auto", "strict"]).default("auto"),
    supplier: partyCanonicalSchema,
    customer: partyCanonicalSchema,
    lines: z.array(invoiceLineCanonicalSchema).min(1),
    totals: invoiceTotalsSchema,
  })
  .superRefine((val, ctx) => {
    const serie = val.serie.toUpperCase();
    const affected = val.affected_document.document_type;
    if (affected === "01" && !serie.startsWith("F")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "NC/ND over factura requires serie F###",
      });
    }
    if (affected === "03" && !serie.startsWith("B")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "NC/ND over boleta requires serie B###",
      });
    }
  });

export type NoteCanonical = z.infer<typeof noteCanonicalSchema>;

export const noteFixtureRequestSchema = z.object({
  company_id: z.string().min(1),
  document_type: noteDocumentTypeSchema.optional(),
  serie: z.string().regex(/^[FfBb][A-Za-z0-9]{3}$/),
  number: z.number().int().positive().optional(),
  issue_date: z.string().min(10),
  currency: z.string().length(3),
  note_type: z.string().min(1),
  reason: z.string().min(1),
  affected_document: affectedDocumentSchema,
  totals_mode: z.enum(["auto", "strict"]).optional(),
  customer: partyCanonicalSchema,
  lines: z.array(invoiceLineInputSchema).min(1),
});

export type NoteFixtureRequest = z.infer<typeof noteFixtureRequestSchema>;

export type { InvoiceLineCanonical, InvoiceLineInput, InvoiceTotals, PartyCanonical };

export function parseNoteFixtureRequest(raw: unknown): NoteFixtureRequest {
  const parsed = noteFixtureRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw ublValidationError("Invalid note fixture request", {
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        issue: i.message,
      })),
    });
  }
  return parsed.data;
}

export function assertNoteCanonical(raw: unknown): NoteCanonical {
  const parsed = noteCanonicalSchema.safeParse(raw);
  if (!parsed.success) {
    throw ublValidationError("Invalid NoteCanonical", {
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        issue: i.message,
      })),
    });
  }
  return parsed.data;
}
