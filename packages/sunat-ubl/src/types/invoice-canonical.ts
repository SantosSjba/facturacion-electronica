import { z } from "zod";

import { ublValidationError } from "../errors";
import { cpeAddressSchema, cpeOptionalFields, cpeTotalsInputSchema } from "./cpe-fields";

/** Party after hydrate (supplier or customer). */
export const partyCanonicalSchema = z
  .object({
    identity_type: z.string().min(1),
    identity_number: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().optional(),
    address: cpeAddressSchema.optional(),
  })
  .strict();

export type PartyCanonical = z.infer<typeof partyCanonicalSchema>;

export const invoiceLineInputSchema = z
  .object({
    id: z.number().int().positive(),
    quantity: z.number().positive(),
    unit_code: z.string().min(1),
    description: z.string().min(1),
    unit_value: z.number().nonnegative(),
    unit_price: z.number().nonnegative().optional(),
    tax_affectation: z.string().min(1),
    igv_percent: z.number().min(0).max(100).optional(),
    tax_scheme_id: z.string().optional(),
    product_code: z.string().min(1).optional(),
    sunat_product_code: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
  })
  .strict();

export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

/** Line after auto-totals. */
export const invoiceLineCanonicalSchema = invoiceLineInputSchema.extend({
  tax_scheme_id: z.string().min(1),
  igv_percent: z.number(),
  unit_price: z.number(),
  line_extension_amount: z.number(),
  tax_amount: z.number(),
  taxable_amount: z.number(),
  tax_category_id: z.string(),
  tax_scheme_name: z.string(),
  tax_type_code: z.string(),
  is_free: z.boolean(),
});

export type InvoiceLineCanonical = z.infer<typeof invoiceLineCanonicalSchema>;

export const taxSubtotalSchema = z.object({
  taxable_amount: z.number(),
  tax_amount: z.number(),
  tax_category_id: z.string(),
  tax_scheme_id: z.string(),
  tax_scheme_name: z.string(),
  tax_type_code: z.string(),
  percent: z.number(),
});

export const invoiceTotalsSchema = z.object({
  line_extension_amount: z.number(),
  tax_amount: z.number(),
  tax_inclusive_amount: z.number(),
  payable_amount: z.number(),
  /** UNECE 5305 category — gravado IGV = S */
  tax_category_id: z.string().default("S"),
  tax_scheme_id: z.string(),
  tax_scheme_name: z.string().default("IGV"),
  tax_subtotals: z.array(taxSubtotalSchema).min(1),
  taxed_amount: z.number(),
  exempt_amount: z.number(),
  unaffected_amount: z.number(),
  export_amount: z.number(),
  free_amount: z.number(),
  free_tax_amount: z.number(),
});

export type InvoiceTotals = z.infer<typeof invoiceTotalsSchema>;

export const invoiceDocumentTypeSchema = z.enum(["01", "03"]);
export type InvoiceDocumentType = z.infer<typeof invoiceDocumentTypeSchema>;

/**
 * Fully hydrated canonical invoice/boleta ready for XML build (docs 11 / 13).
 */
export const invoiceCanonicalSchema = z
  .object({
    document_type: invoiceDocumentTypeSchema.default("01"),
    serie: z.string().regex(/^[FfBb][A-Za-z0-9]{3}$/),
    number: z.number().int().positive(),
    operation_type: z.string().length(4),
    issue_date: z.string().min(10),
    ...cpeOptionalFields,
    currency: z.string().length(3),
    totals_mode: z.enum(["auto", "strict"]).default("auto"),
    supplier: partyCanonicalSchema,
    customer: partyCanonicalSchema,
    lines: z.array(invoiceLineCanonicalSchema).min(1),
    totals: invoiceTotalsSchema,
  })
  .superRefine((val, ctx) => {
    const serie = val.serie.toUpperCase();
    if (val.document_type === "01" && !serie.startsWith("F")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "Factura 01 requires serie F###",
      });
    }
    if (val.document_type === "03" && !serie.startsWith("B")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "Boleta 03 requires serie B###",
      });
    }
  });

export type InvoiceCanonical = z.infer<typeof invoiceCanonicalSchema>;

/** Raw fixture `request` shape (pre-hydrate). */
export const invoiceFixtureRequestSchema = z
  .object({
    company_id: z.string().min(1),
    document_type: invoiceDocumentTypeSchema.optional(),
    serie: z.string().regex(/^[FfBb][A-Za-z0-9]{3}$/),
    number: z.number().int().positive().optional(),
    operation_type: z.string().length(4),
    issue_date: z.string().min(10),
    ...cpeOptionalFields,
    currency: z.string().length(3),
    totals_mode: z.enum(["auto", "strict"]).optional(),
    customer: partyCanonicalSchema,
    lines: z.array(invoiceLineInputSchema).min(1),
    totals: cpeTotalsInputSchema.optional(),
  })
  .superRefine((val, ctx) => {
    const docType = val.document_type ?? (val.serie.toUpperCase().startsWith("B") ? "03" : "01");
    const serie = val.serie.toUpperCase();
    if (docType === "01" && !serie.startsWith("F")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "Factura 01 requires serie F###",
      });
    }
    if (docType === "03" && !serie.startsWith("B")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "Boleta 03 requires serie B###",
      });
    }
  });

export type InvoiceFixtureRequest = z.infer<typeof invoiceFixtureRequestSchema>;

export function resolveInvoiceDocumentType(request: InvoiceFixtureRequest): InvoiceDocumentType {
  if (request.document_type) return request.document_type;
  return request.serie.toUpperCase().startsWith("B") ? "03" : "01";
}

export function parseFixtureRequest(raw: unknown): InvoiceFixtureRequest {
  const parsed = invoiceFixtureRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw ublValidationError("Invalid invoice fixture request", {
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        issue: i.message,
      })),
    });
  }
  return parsed.data;
}

export function assertInvoiceCanonical(raw: unknown): InvoiceCanonical {
  const parsed = invoiceCanonicalSchema.safeParse(raw);
  if (!parsed.success) {
    throw ublValidationError("Invalid InvoiceCanonical", {
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        issue: i.message,
      })),
    });
  }
  return parsed.data;
}
