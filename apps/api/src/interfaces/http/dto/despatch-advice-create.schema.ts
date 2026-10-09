import { z } from "zod";
import {
  despatchCanonicalFields,
  despatchPartySchema,
  validateDespatch,
} from "@factosys/sunat-ubl";

const { supplier, supplier_party, number, ...fields } = despatchCanonicalFields;
void supplier;
void supplier_party;
void number;
export const despatchAdviceCreateSchema = z
  .object({
    ...fields,
    company_id: z.string().uuid(),
    supplier: despatchPartySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => validateDespatch({ ...value, supplier: undefined }, ctx));
export type DespatchAdviceCreate = z.infer<typeof despatchAdviceCreateSchema>;
