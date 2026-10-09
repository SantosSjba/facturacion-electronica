import { z } from "zod";
import { cpeAddressSchema } from "./cpe-fields";

const party = z
  .object({
    identity_type: z.string().min(1),
    identity_number: z.string().min(1),
    name: z.string().min(1).max(100),
    address: cpeAddressSchema.optional(),
  })
  .strict();
const location = z
  .object({
    ubigeo: z.string().regex(/^\d{6}$/),
    address: z.string().min(1).max(100),
    establishment_code: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    establishment_ruc: z
      .string()
      .regex(/^\d{11}$/)
      .optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.establishment_code) === Boolean(v.establishment_ruc),
    "Establishment code and RUC must be supplied together",
  );
export const embeddedDespatchSchema = z
  .object({
    origin: location,
    destination: location,
    carrier: party.optional(),
    transport_mode: z.enum(["01", "02"]),
    gross_weight: z.number().positive().multipleOf(0.001),
    weight_unit: z.enum(["KGM", "TNE"]),
    vehicle_plate: z.string().regex(/^[A-Z0-9-]{3,8}$/),
    vehicle_brand: z.string().min(1).max(40).optional(),
    authorization: z.string().min(1).max(40).optional(),
    driver_license: z.string().min(1).max(20).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.transport_mode === "01" &&
      (!v.carrier || v.carrier.identity_type !== "6" || !/^\d{11}$/.test(v.carrier.identity_number))
    )
      ctx.addIssue({
        code: "custom",
        path: ["carrier"],
        message: "Public transport requires carrier RUC",
      });
    if (v.transport_mode === "02" && !v.driver_license)
      ctx.addIssue({
        code: "custom",
        path: ["driver_license"],
        message: "Private transport requires driver license",
      });
  });
export const salePerceptionSchema = z
  .object({
    regime: z.enum(["01", "02", "03"]),
    base_amount: z.number().positive().multipleOf(0.01),
    amount: z.number().positive().multipleOf(0.01),
    total_amount: z.number().positive().multipleOf(0.01),
    customer_is_perception_agent: z.boolean().optional(),
  })
  .strict();
export const itemAttributeSchema = z
  .object({
    code: z.string().regex(/^\d{4}$/),
    name: z.string().min(1).max(100),
    value: z.string().min(1).max(500),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional(),
    duration_days: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((v) => !v.start_date || !v.end_date || v.start_date <= v.end_date, {
    path: ["end_date"],
    message: "End date precedes start date",
  });
export const extendedCommercialFields = {
  seller: party.optional(),
  delivery_address: cpeAddressSchema.optional(),
  embedded_despatch: embeddedDespatchSchema.optional(),
  sale_perception: salePerceptionSchema.optional(),
  rounding_amount: z.number().min(-1).max(1).multipleOf(0.01).optional(),
  related_documents: z
    .array(
      z
        .object({ document_type: z.string().regex(/^\d{2}$/), number: z.string().min(1).max(100) })
        .strict(),
    )
    .max(50)
    .optional(),
};
export const extendedLineFields = {
  gs1_product_code: z
    .string()
    .regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/)
    .refine((value) => {
      const digits = [...value].map(Number);
      const check = digits.pop();
      const sum = digits
        .reverse()
        .reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
      return (10 - (sum % 10)) % 10 === check;
    }, "Invalid GTIN check digit")
    .optional(),
  attributes: z
    .array(itemAttributeSchema)
    .max(50)
    .refine((v) => new Set(v.map((a) => a.code)).size === v.length, "Duplicate attribute code")
    .optional(),
};
