import { z } from "zod";

import { creditNoteCreateSchema } from "./credit-note-create.schema";

/**
 * DebitNoteCreate (08) — same shape as credit note; note_type = cat. 10.
 */
export const debitNoteCreateSchema = creditNoteCreateSchema;

export type DebitNoteCreate = z.infer<typeof debitNoteCreateSchema>;
