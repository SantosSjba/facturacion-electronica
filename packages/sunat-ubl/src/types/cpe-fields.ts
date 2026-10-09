import { z } from "zod";

/** Address contract shared by the HTTP boundary and the UBL model. */
export const cpeAddressSchema = z
  .object({
    line: z.string().min(1).optional(),
    ubigeo: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    department: z.string().min(1).optional(),
    province: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    urbanization: z.string().min(1).optional(),
    country_code: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    establishment_code: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .strict();

export const cpeLegendSchema = z
  .object({
    code: z.string().regex(/^\d{4}$/),
    text: z.string().min(1),
  })
  .strict();

export const cpeTotalsInputSchema = z
  .object({
    rounding_amount: z.number().optional(),
    perception_amount: z.number().nonnegative().optional(),
    line_extension_amount: z.number().nonnegative(),
    tax_amount: z.number().nonnegative(),
    tax_inclusive_amount: z.number().nonnegative(),
    payable_amount: z.number().nonnegative(),
    taxed_amount: z.number().nonnegative().optional(),
    exempt_amount: z.number().nonnegative().optional(),
    unaffected_amount: z.number().nonnegative().optional(),
    export_amount: z.number().nonnegative().optional(),
    free_amount: z.number().nonnegative().optional(),
    free_tax_amount: z.number().nonnegative().optional(),
    prepaid_amount: z.number().nonnegative().optional(),
    allowance_total_amount: z.number().nonnegative().optional(),
    charge_total_amount: z.number().nonnegative().optional(),
    igv_amount: z.number().nonnegative().optional(),
    ivap_amount: z.number().nonnegative().optional(),
    isc_amount: z.number().nonnegative().optional(),
    icbper_amount: z.number().nonnegative().optional(),
  })
  .strict();

export const cpeOptionalFields = {
  pdf_format: z.enum(["A4", "A5", "TICKET80", "TICKET58"]).optional(),
  observations: z.string().max(2000).optional(),
  issue_time: z.iso.time({ precision: 0 }).optional(),
  due_date: z.iso.date().optional(),
  purchase_order: z.string().min(1).optional(),
  legends: z.array(cpeLegendSchema).optional(),
};
