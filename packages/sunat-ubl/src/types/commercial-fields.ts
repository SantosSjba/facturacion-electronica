import { z } from "zod";
import { extendedCommercialFields, extendedLineFields } from "./extended-commercial-fields";

const money = z.number().nonnegative();
const amount = z.number().positive();
const code = z.string().min(1);
export const installmentSchema = z
  .object({
    number: z.number().int().min(1).max(999),
    due_date: z.iso.date(),
    amount,
  })
  .strict();
export const paymentTermsSchema = z.discriminatedUnion("condition", [
  z.object({ condition: z.literal("cash") }).strict(),
  z
    .object({
      condition: z.literal("credit"),
      currency: z.string().length(3),
      outstanding_amount: amount,
      installments: z.array(installmentSchema).min(1),
    })
    .strict(),
]);
export const paymentMeansSchema = z
  .object({
    code: z.string().regex(/^\d{3}$/),
    account: code.optional(),
    bank: code.optional(),
    reference: code.optional(),
    due_date: z.iso.date().optional(),
  })
  .strict();
export const adjustmentSchema = z
  .object({
    code: z.enum([
      "00",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "20",
      "46",
      "47",
      "48",
      "49",
      "50",
      "51",
      "52",
      "53",
    ]),
    reason: code.optional(),
    base_amount: amount,
    amount,
    factor: z.number().positive().optional(),
    tax_affectation: z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
    tax_scheme_id: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    percent: z.number().min(0).max(100).optional(),
    tier_range: z.string().optional(),
    related_percent: z.number().optional(),
  })
  .strict();
export const prepaymentSchema = z
  .object({
    id: z.number().int().min(1).max(99),
    document_type: z.enum(["01", "03"]),
    serie_number: z.string().regex(/^[FB][A-Z0-9]{3}-\d{1,8}$/),
    issuer_ruc: z.string().regex(/^\d{11}$/),
    paid_date: z.iso.date(),
    amount,
    base_amount: amount,
    tax_affectation: z.enum(["10", "17", "20", "30"]),
    percent: z.number().min(0).max(100).optional(),
    isc_amount: money.optional(),
    isc_percent: z.number().positive().optional(),
    isc_system: z.enum(["01", "02", "03"]).optional(),
  })
  .strict();
export const iscSchema = z.discriminatedUnion("system", [
  z.object({ system: z.literal("01"), percent: amount.max(100) }).strict(),
  z.object({ system: z.literal("02"), per_unit_amount: amount }).strict(),
  z
    .object({
      system: z.literal("03"),
      retail_unit_price: amount,
      factor: amount.max(1),
      percent: amount.max(100),
    })
    .strict(),
]);
export const icbperSchema = z
  .object({ quantity: z.number().int().positive(), per_unit_amount: amount })
  .strict();
const point = z.object({ ubigeo: z.string().regex(/^\d{6}$/), address: code }).strict();
export const cargoTransportSchema = z
  .object({
    origin: point,
    destination: point,
    trip_description: code,
    reference_amount: amount,
    reference_load_amount: amount,
    reference_vehicle_amount: amount,
    trips: z
      .array(
        z
          .object({
            configuration: code,
            tons: amount,
            effective_tons: amount,
            reference_amount: amount,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export const hydrobiologySchema = z
  .object({
    vessel_registration: code,
    vessel_name: code,
    species: code,
    quantity: amount,
    unloading_place: code,
    unloading_date: z.iso.date(),
  })
  .strict();
export const passengerTransportSchema = z
  .object({
    vehicle_plate: code,
    service_date: z.iso.date(),
    origin: code,
    destination: code,
  })
  .strict();
export const detractionSchema = z
  .object({
    goods_code: z.string().regex(/^\d{3}$/),
    percent: amount.max(100),
    amount,
    account: z.string().regex(/^\d{11}$/),
    payment_means_code: z.string().regex(/^\d{3}$/),
    currency: z.literal("PEN").default("PEN"),
  })
  .strict();
export const exchangeRateSchema = z
  .object({
    source_currency: z.string().length(3),
    target_currency: z.literal("PEN"),
    rate: amount,
    date: z.iso.date(),
    source: code,
  })
  .strict();
export const commercialFields = {
  ...extendedCommercialFields,
  payment_terms: paymentTermsSchema.optional(),
  payment_means: z.array(paymentMeansSchema).optional(),
  adjustments: z.array(adjustmentSchema).optional(),
  prepayments: z.array(prepaymentSchema).optional(),
  detraction: detractionSchema.optional(),
  exchange_rate: exchangeRateSchema.optional(),
  despatch_references: z
    .array(z.object({ document_type: z.enum(["09", "31"]), serie_number: code }).strict())
    .optional(),
};
export const commercialLineFields = {
  ...extendedLineFields,
  adjustments: z.array(adjustmentSchema).optional(),
  isc: iscSchema.optional(),
  icbper: icbperSchema.optional(),
  cargo_transport: cargoTransportSchema.optional(),
  hydrobiology: hydrobiologySchema.optional(),
  passenger_transport: passengerTransportSchema.optional(),
};
export type Adjustment = z.infer<typeof adjustmentSchema>;
export type CommercialFields = {
  [K in keyof typeof commercialFields]?: z.infer<(typeof commercialFields)[K]>;
};
