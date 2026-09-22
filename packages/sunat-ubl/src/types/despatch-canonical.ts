import { z } from "zod";

import { ublValidationError } from "../errors";
import { partyCanonicalSchema, type PartyCanonical } from "./invoice-canonical";

export const despatchDocumentTypeSchema = z.enum(["09", "31"]);
export type DespatchDocumentType = z.infer<typeof despatchDocumentTypeSchema>;

export const despatchLocationSchema = z.object({
  ubigeo: z.string().min(1),
  address: z.string().min(1),
  establishment_code: z.string().optional(),
});

export type DespatchLocation = z.infer<typeof despatchLocationSchema>;

export const despatchCarrierSchema = partyCanonicalSchema.extend({
  mtc_registration: z.string().optional(),
});

export type DespatchCarrier = z.infer<typeof despatchCarrierSchema>;

export const despatchVehicleSchema = z.object({
  plate: z.string().min(1),
  authority_code: z.string().optional(),
});

export type DespatchVehicle = z.infer<typeof despatchVehicleSchema>;

export const despatchDriverSchema = z.object({
  job_title: z.string().optional(),
  identity_type: z.string().min(1),
  identity_number: z.string().min(1),
  name: z.string().min(1),
  license: z.string().optional(),
});

export type DespatchDriver = z.infer<typeof despatchDriverSchema>;

export const despatchShipmentSchema = z.object({
  transfer_reason_code: z.string().optional(),
  transfer_reason_text: z.string().optional(),
  transport_mode_code: z.string().optional(),
  gross_weight: z.number().positive(),
  gross_weight_unit: z.string().min(1),
  total_packages: z.number().optional(),
  start_date: z.string().min(10),
  start_time: z.string().optional(),
  carrier: despatchCarrierSchema.optional(),
  vehicles: z.array(despatchVehicleSchema).optional(),
  drivers: z.array(despatchDriverSchema).optional(),
  origin: despatchLocationSchema,
  destination: despatchLocationSchema,
  container_id: z.string().optional(),
  port_code: z.string().optional(),
});

export type DespatchShipment = z.infer<typeof despatchShipmentSchema>;

export const despatchRelatedDocumentSchema = z.object({
  document_type: z.string().min(1),
  serie_number: z.string().min(1),
});

export type DespatchRelatedDocument = z.infer<
  typeof despatchRelatedDocumentSchema
>;

export const despatchLineSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().positive(),
  unit_code: z.string().min(1),
  description: z.string().min(1),
  product_code: z.string().optional(),
  sunat_product_code: z.string().optional(),
});

export type DespatchLineCanonical = z.infer<typeof despatchLineSchema>;

/**
 * Hydrated GRE DespatchAdvice canonical (dict 18).
 * `supplier` = emisor (DespatchSupplierParty).
 * `supplier_party` = proveedor (SellerSupplierParty), optional.
 * `shipper` = remitente for tipo 31 (DespatchParty).
 */
export const despatchCanonicalSchema = z
  .object({
    document_type: despatchDocumentTypeSchema,
    serie: z.string().min(4).max(4),
    number: z.number().int().positive(),
    issue_date: z.string().min(10),
    issue_time: z.string().optional(),
    notes: z.string().optional(),
    supplier: partyCanonicalSchema,
    shipper: partyCanonicalSchema.optional(),
    delivery_customer: partyCanonicalSchema,
    supplier_party: partyCanonicalSchema.optional(),
    buyer: partyCanonicalSchema.optional(),
    shipment: despatchShipmentSchema,
    related_documents: z.array(despatchRelatedDocumentSchema).optional(),
    lines: z.array(despatchLineSchema).min(1),
  })
  .superRefine((val, ctx) => {
    const serie = val.serie.toUpperCase();
    if (val.document_type === "09" && !serie.startsWith("T")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "GRE 09 requires serie T###",
      });
    }
    if (val.document_type === "31" && !serie.startsWith("V")) {
      ctx.addIssue({
        code: "custom",
        path: ["serie"],
        message: "GRE 31 requires serie V###",
      });
    }
    if (val.document_type === "09") {
      if (!val.shipment.transfer_reason_code) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "transfer_reason_code"],
          message: "GRE 09 requires transfer_reason_code",
        });
      }
      if (!val.shipment.transport_mode_code) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "transport_mode_code"],
          message: "GRE 09 requires transport_mode_code",
        });
      }
    }
    if (val.document_type === "31") {
      if (!val.shipper) {
        ctx.addIssue({
          code: "custom",
          path: ["shipper"],
          message: "GRE 31 requires shipper (remitente)",
        });
      }
      if (!val.shipment.vehicles?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "vehicles"],
          message: "GRE 31 requires at least one vehicle plate",
        });
      }
      const primary = val.shipment.drivers?.[0];
      if (!primary?.license) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "drivers"],
          message: "GRE 31 requires primary driver license",
        });
      }
    }
  });

export type DespatchCanonical = z.infer<typeof despatchCanonicalSchema>;

export type { PartyCanonical };

export function assertDespatchCanonical(raw: unknown): DespatchCanonical {
  const parsed = despatchCanonicalSchema.safeParse(raw);
  if (!parsed.success) {
    throw ublValidationError("Invalid DespatchCanonical", {
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        issue: i.message,
      })),
    });
  }
  return parsed.data;
}
