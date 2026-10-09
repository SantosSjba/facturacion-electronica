import { z } from "zod";
import { isValidRuc } from "@factosys/domain";
import { cpeAddressSchema } from "./cpe-fields";
import { ublValidationError } from "../errors";
const date = z.iso.date();
const money = z
  .number()
  .finite()
  .positive()
  .max(999999999999.99)
  .refine((n) => n === Number(n.toFixed(2)), "Use at most two decimals");
const party = z
  .object({
    identity_type: z.literal("6"),
    identity_number: z.string().refine(isValidRuc, "Invalid RUC"),
    name: z.string().trim().min(1).max(100),
    trade_name: z.string().max(100).optional(),
    address: cpeAddressSchema.optional(),
  })
  .strict();
export const taxAgentSettingsSchema = z
  .object({
    retention: z.boolean().default(false),
    perception_regimes: z
      .array(z.enum(["01", "02", "03"]))
      .max(3)
      .default([]),
  })
  .strict();
export const taxAgentFields = {
  issue_date: date,
  issue_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
    .optional(),
  currency: z.literal("PEN").default("PEN"),
  customer: party,
  regime: z.enum(["01", "02", "03"]),
  observations: z.string().max(250).optional(),
  totals_mode: z.enum(["auto", "strict"]).default("auto"),
  totals: z.object({ tax_amount: money, settlement_amount: money }).strict().optional(),
  pdf_format: z.enum(["A4", "A5", "TICKET80", "TICKET58"]).optional(),
  documents: z
    .array(
      z
        .object({
          document_type: z.enum(["01", "03", "08", "12"]),
          serie_number: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9]{1,20}-[0-9]{1,12}$/)
            .refine((s) => Number(s.split("-")[1]) > 0, "Reference number must be positive")
            .transform((s) => s.replace(/-0+(\d+)$/, "-$1")),
          issue_date: date,
          currency: z.enum(["PEN", "USD", "EUR"]),
          total_amount: money,
          credit_notes: z
            .array(
              z
                .object({
                  serie_number: z
                    .string()
                    .trim()
                    .toUpperCase()
                    .regex(/^[A-Z0-9]{4}-[0-9]{1,8}$/)
                    .refine((s) => Number(s.split("-")[1]) > 0)
                    .transform((s) => s.replace(/-0+(\d+)$/, "-$1")),
                  issue_date: date,
                  total_amount: money,
                })
                .strict(),
            )
            .max(100)
            .optional(),
          payments: z
            .array(
              z
                .object({
                  number: z.number().int().min(1).max(99999),
                  date,
                  amount: money,
                  tax_date: date.optional(),
                  tax_amount: money.optional(),
                  settlement_amount: money.optional(),
                  exchange_rate: z
                    .object({
                      source_currency: z.enum(["USD", "EUR"]),
                      target_currency: z.literal("PEN").default("PEN"),
                      rate: z
                        .number()
                        .positive()
                        .max(9999.999999)
                        .refine((n) => n === Number(n.toFixed(6)), "Use at most six decimals"),
                      date,
                    })
                    .strict()
                    .optional(),
                })
                .strict(),
            )
            .min(1)
            .max(100),
        })
        .strict(),
    )
    .min(1)
    .max(500),
};
export const retentionInputSchema = z
  .object({
    ...taxAgentFields,
    serie: z
      .string()
      .toUpperCase()
      .regex(/^R[A-Z0-9]{3}$/),
    regime: z.literal("01").default("01"),
  })
  .strict();
export const perceptionInputSchema = z
  .object({
    ...taxAgentFields,
    serie: z
      .string()
      .toUpperCase()
      .regex(/^P[A-Z0-9]{3}$/),
    customer_is_perception_agent: z.boolean().optional(),
  })
  .strict();
export type TaxAgentInput = z.infer<typeof perceptionInputSchema>;
export interface TaxAgentReference {
  document_type: string;
  serie_number: string;
  issue_date: string;
  currency: string;
  total_amount: number;
  payment?: { number: number; date: string; amount: number };
  tax_date?: string;
  tax_amount?: number;
  settlement_amount?: number;
  adjusts_document?: { document_type: string; serie_number: string };
  exchange_rate?: {
    source_currency: "USD" | "EUR";
    target_currency: "PEN";
    rate: number;
    date: string;
  };
}
export interface TaxAgentCanonical {
  document_type: "20" | "40";
  serie: string;
  number: number;
  issue_date: string;
  issue_time?: string;
  currency: "PEN";
  supplier: z.infer<typeof party>;
  customer: z.infer<typeof party>;
  regime: string;
  percent: number;
  observations?: string;
  references: TaxAgentReference[];
  totals: { tax_amount: number; settlement_amount: number };
}
export const PERCEPTION_RATES = { "01": 2, "02": 1, "03": 0.5 } as const;
const cents = (n: number) => BigInt(Math.round(n * 100));
const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
const fail = (message: string) => {
  throw ublValidationError(message);
};
/** Independent tax-agent payments: withholding subtracts; perception adds to the collection. */
export function toTaxAgentCanonical(
  type: "20" | "40",
  raw: TaxAgentInput,
  supplier: TaxAgentCanonical["supplier"],
  number: number,
): TaxAgentCanonical {
  const parsed = (type === "20" ? retentionInputSchema : perceptionInputSchema).safeParse(raw);
  if (!parsed.success) return fail(parsed.error.message);
  const body = parsed.data;
  if (
    type === "40" &&
    body.regime === "03" &&
    !(body as TaxAgentInput).customer_is_perception_agent
  )
    return fail("Regime 03 requires confirmation that customer is also a perception agent");
  if (!Number.isSafeInteger(number) || number < 1 || number > 99999999)
    return fail("Correlative must be 1–99999999");
  if (supplier.identity_number === body.customer.identity_number)
    return fail("Agent and counterparty must be different RUCs");
  const percent = type === "20" ? 3 : PERCEPTION_RATES[body.regime];
  const references: TaxAgentReference[] = [],
    seen = new Set<string>(),
    seenCreditNotes = new Set<string>();
  let sumTax = 0n,
    sumSettlement = 0n;
  const documentKeys = new Set<string>();
  for (const doc of body.documents) {
    if (type === "40" && body.regime === "03" && !["01", "08"].includes(doc.document_type))
      return fail("Regime 03 requires a tax-credit supporting invoice/debit note");
    const documentKey = `${doc.document_type}/${doc.serie_number}`;
    if (documentKeys.has(documentKey))
      return fail("Repeat related document in one object with all payments");
    documentKeys.add(documentKey);
    if (type === "20" && doc.document_type === "03")
      return fail("Retention does not admit boleta references");
    if (doc.document_type !== "12" && !/^[A-Z0-9]{4}-[1-9][0-9]{0,7}$/.test(doc.serie_number))
      return fail("Reference requires four-character series and up to eight digits");
    if (doc.issue_date > body.issue_date)
      return fail("Related document issued after tax-agent document");
    let creditTotal = 0n;
    for (const note of doc.credit_notes ?? []) {
      if (seenCreditNotes.has(note.serie_number))
        return fail("Credit note cannot adjust multiple references in one request");
      seenCreditNotes.add(note.serie_number);
      if (note.issue_date < doc.issue_date || note.issue_date > body.issue_date)
        return fail("Credit note date outside reference/issue interval");
      creditTotal += cents(note.total_amount);
      references.push({
        document_type: "07",
        serie_number: note.serie_number,
        issue_date: note.issue_date,
        currency: doc.currency,
        total_amount: note.total_amount,
        adjusts_document: { document_type: doc.document_type, serie_number: doc.serie_number },
      });
    }
    let paid = 0n;
    for (const payment of doc.payments) {
      const key = `${doc.document_type}/${doc.serie_number}/${payment.number}`;
      if (seen.has(key)) return fail("Duplicate payment number for related document");
      seen.add(key);
      if (payment.date < doc.issue_date || payment.date > body.issue_date)
        return fail("Payment date must be between reference and issue date");
      const taxDate = payment.tax_date ?? payment.date;
      if (taxDate !== payment.date) return fail("Tax date must match the payment/collection date");
      const fx = payment.exchange_rate;
      if (
        doc.currency !== "PEN" &&
        (!fx || fx.source_currency !== doc.currency || fx.date !== payment.date)
      )
        return fail("Foreign currency requires its payment-date exchange rate to PEN");
      if (doc.currency === "PEN" && fx) return fail("PEN payments must not include exchange rate");
      paid += cents(payment.amount);
      const base = fx
        ? rounded(cents(payment.amount) * BigInt(Math.round(fx.rate * 1000000)), 1000000n)
        : cents(payment.amount);
      const tax = rounded(base * BigInt(Math.round(percent * 100)), 10000n);
      const settlement = type === "20" ? base - tax : base + tax;
      if (tax === 0n) return fail("Tax amount rounds to zero");
      if (
        body.totals_mode === "strict" &&
        (payment.tax_amount === undefined || payment.settlement_amount === undefined)
      )
        return fail("Strict requires tax and settlement for every payment");
      if (
        (payment.tax_amount !== undefined && cents(payment.tax_amount) !== tax) ||
        (payment.settlement_amount !== undefined && cents(payment.settlement_amount) !== settlement)
      )
        return fail("Payment totals disagree with regime calculation");
      references.push({
        document_type: doc.document_type,
        serie_number: doc.serie_number,
        issue_date: doc.issue_date,
        currency: doc.currency,
        total_amount: doc.total_amount,
        payment: { number: payment.number, date: payment.date, amount: payment.amount },
        tax_date: taxDate,
        tax_amount: Number(tax) / 100,
        settlement_amount: Number(settlement) / 100,
        exchange_rate: fx,
      });
      sumTax += tax;
      sumSettlement += settlement;
    }
    if (paid + creditTotal > cents(doc.total_amount))
      return fail("Payments exceed related document total after credit notes");
  }
  if (references.length > 500) return fail("Maximum 500 payment references per document");
  if (sumTax > 99999999999999n || sumSettlement > 99999999999999n)
    return fail("Totals exceed twelve integer digits");
  if (body.totals_mode === "strict" && !body.totals) return fail("Strict requires document totals");
  if (
    body.totals &&
    (cents(body.totals.tax_amount) !== sumTax ||
      cents(body.totals.settlement_amount) !== sumSettlement)
  )
    return fail("Document totals differ from payment totals");
  return {
    document_type: type,
    serie: body.serie,
    number,
    issue_date: body.issue_date,
    issue_time: body.issue_time,
    currency: "PEN",
    supplier,
    customer: body.customer,
    regime: body.regime,
    percent,
    observations: body.observations,
    references,
    totals: { tax_amount: Number(sumTax) / 100, settlement_amount: Number(sumSettlement) / 100 },
  };
}
