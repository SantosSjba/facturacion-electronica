import { z } from "zod";

const partySchema = z
  .object({
    identity_type: z.string().min(1),
    identity_number: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

const locationSchema = z
  .object({
    ubigeo: z.string().min(1),
    address: z.string().min(1),
    establishment_code: z.string().optional(),
  })
  .strict();

/**
 * DespatchAdviceCreate — aligned to artifacts/schemas/despatch-advice-create.schema.json.
 */
export const despatchAdviceCreateSchema = z
  .object({
    company_id: z.string().uuid(),
    document_type: z.enum(["09", "31"]),
    serie: z.string().length(4),
    number: z.number().int().positive().optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    issue_time: z.string().optional(),
    notes: z.string().optional(),
    shipper: partySchema.optional(),
    delivery_customer: partySchema,
    supplier: partySchema.optional(),
    buyer: partySchema.optional(),
    shipment: z
      .object({
        transfer_reason_code: z.string().optional(),
        transfer_reason_text: z.string().optional(),
        transport_mode_code: z.string().optional(),
        gross_weight: z.number().positive(),
        gross_weight_unit: z.string().min(1),
        total_packages: z.number().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start_time: z.string().optional(),
        carrier: z
          .object({
            identity_type: z.string().optional(),
            identity_number: z.string().optional(),
            name: z.string().optional(),
            mtc_registration: z.string().optional(),
          })
          .strict()
          .optional(),
        vehicles: z
          .array(
            z
              .object({
                plate: z.string().min(1),
                authority_code: z.string().optional(),
              })
              .strict(),
          )
          .optional(),
        drivers: z
          .array(
            z
              .object({
                job_title: z.string().optional(),
                identity_type: z.string().min(1),
                identity_number: z.string().min(1),
                name: z.string().min(1),
                license: z.string().optional(),
              })
              .strict(),
          )
          .optional(),
        origin: locationSchema,
        destination: locationSchema,
        container_id: z.string().optional(),
        port_code: z.string().optional(),
      })
      .strict(),
    related_documents: z
      .array(
        z
          .object({
            document_type: z.string().min(1),
            serie_number: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    lines: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            quantity: z.number().positive(),
            unit_code: z.string().min(1),
            description: z.string().min(1),
            product_code: z.string().optional(),
            sunat_product_code: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((val, ctx) => {
    const serie = val.serie.toUpperCase();
    if (val.document_type === "09") {
      if (!/^T[A-Z0-9]{3}$/i.test(serie)) {
        ctx.addIssue({
          code: "custom",
          path: ["serie"],
          message: "GRE 09 requires serie T###",
        });
      }
      if (!val.shipment.transfer_reason_code) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "transfer_reason_code"],
          message: "required for document_type 09",
        });
      }
      if (!val.shipment.transport_mode_code) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "transport_mode_code"],
          message: "required for document_type 09",
        });
      }
    }
    if (val.document_type === "31") {
      if (!/^V[A-Z0-9]{3}$/i.test(serie)) {
        ctx.addIssue({
          code: "custom",
          path: ["serie"],
          message: "GRE 31 requires serie V###",
        });
      }
      if (!val.shipper) {
        ctx.addIssue({
          code: "custom",
          path: ["shipper"],
          message: "required for document_type 31",
        });
      }
      if (!val.shipment.vehicles?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "vehicles"],
          message: "required for document_type 31",
        });
      }
      if (!val.shipment.drivers?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["shipment", "drivers"],
          message: "required for document_type 31",
        });
      } else {
        const principal = val.shipment.drivers[0];
        if (!principal?.license) {
          ctx.addIssue({
            code: "custom",
            path: ["shipment", "drivers", 0, "license"],
            message: "license required for principal driver (31)",
          });
        }
      }
    }
  });

export type DespatchAdviceCreate = z.infer<typeof despatchAdviceCreateSchema>;
