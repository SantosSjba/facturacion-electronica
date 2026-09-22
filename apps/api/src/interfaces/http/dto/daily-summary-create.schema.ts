import { z } from "zod";

/**
 * DailySummaryCreate — aligned to artifacts/schemas/daily-summary-create.schema.json.
 */
export const dailySummaryCreateSchema = z
  .object({
    company_id: z.string().uuid(),
    reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    correlative: z.number().int().positive().optional(),
    document_ids: z.array(z.string().uuid()).optional(),
    lines: z
      .array(
        z
          .object({
            document_id: z.string().uuid().optional(),
            document_type: z.enum(["03", "07", "08"]).optional(),
            serie_number: z.string().optional(),
            status: z.enum(["1", "2", "3"]).optional(),
            customer: z.record(z.string(), z.unknown()).optional(),
            totals: z.record(z.string(), z.unknown()).optional(),
            affected_document: z.record(z.string(), z.unknown()).optional(),
            perception: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type DailySummaryCreate = z.infer<typeof dailySummaryCreateSchema>;
