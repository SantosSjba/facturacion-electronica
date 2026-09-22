import { z } from "zod";

/**
 * VoidedDocumentCreate — aligned to artifacts/schemas/voided-document-create.schema.json.
 */
export const voidedDocumentCreateSchema = z
  .object({
    company_id: z.string().uuid(),
    reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    correlative: z.number().int().positive().optional(),
    documents: z
      .array(
        z
          .object({
            line_id: z.number().int().positive().optional(),
            document_type: z.string().min(1),
            serie_number: z.string().optional(),
            serie: z.string().optional(),
            number: z.number().int().positive().optional(),
            reason: z.string().min(1),
          })
          .strict()
          .refine(
            (d) =>
              Boolean(d.serie_number) ||
              (Boolean(d.serie) && d.number != null),
            { message: "serie_number or serie+number required" },
          ),
      )
      .min(1),
  })
  .strict();

export type VoidedDocumentCreate = z.infer<typeof voidedDocumentCreateSchema>;
