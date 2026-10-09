import { z } from "zod";
import { ublValidationError } from "../errors";
import { partyCanonicalSchema, type PartyCanonical } from "./invoice-canonical";

const text = (max: number) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
const weight = z
  .number()
  .positive()
  .max(999999999999.999)
  .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 0.00001, "Maximum 3 decimal places");
export const despatchDocumentTypeSchema = z.enum(["09", "31"]);
export type DespatchDocumentType = z.infer<typeof despatchDocumentTypeSchema>;
export const despatchPartySchema = z
  .object({
    identity_type: z.enum(["0", "1", "4", "6", "7", "A", "B", "C", "D", "E", "F", "G"]),
    identity_number: text(15),
    name: text(250),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.identity_type === "6" && !/^\d{11}$/.test(v.identity_number))
      ctx.addIssue({
        code: "custom",
        path: ["identity_number"],
        message: "RUC requires 11 digits",
      });
    if (v.identity_type === "1" && !/^\d{8}$/.test(v.identity_number))
      ctx.addIssue({ code: "custom", path: ["identity_number"], message: "DNI requires 8 digits" });
  });
export const despatchLocationSchema = z
  .object({
    ubigeo: z.string().regex(/^\d{6}$/),
    address: text(500),
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
  .superRefine((v, ctx) => {
    if (!!v.establishment_code !== !!v.establishment_ruc)
      ctx.addIssue({
        code: "custom",
        path: ["establishment_code"],
        message: "Establishment code requires associated RUC, and vice versa",
      });
  });
export type DespatchLocation = z.infer<typeof despatchLocationSchema>;
export const despatchAuthorizationSchema = z
  .object({
    entity_code: z.string().regex(/^\d{2}$/),
    number: text(50),
  })
  .strict();
export const despatchCarrierSchema = despatchPartySchema.safeExtend({
  mtc_registration: z
    .string()
    .regex(/^[A-Z0-9]{1,20}$/)
    .optional(),
  authorization: despatchAuthorizationSchema.optional(),
});
export type DespatchCarrier = z.infer<typeof despatchCarrierSchema>;
export const despatchVehicleSchema = z
  .object({
    plate: z
      .string()
      .regex(/^[A-Z0-9-]{6,8}$/)
      .refine((v) => /^[A-Z0-9]{6,8}$/.test(v.replace(/-/g, "")), "Invalid plate"),
    authority_code: text(50).optional(),
    authority_entity_code: z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
    tuc: z
      .string()
      .regex(/^[A-Z0-9]{1,15}$/)
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!!v.authority_code !== !!v.authority_entity_code)
      ctx.addIssue({
        code: "custom",
        path: ["authority_code"],
        message: "Authorization requires issuing entity code",
      });
  });
export type DespatchVehicle = z.infer<typeof despatchVehicleSchema>;
export const despatchDriverSchema = z
  .object({
    job_title: z.enum(["Principal", "Secundario"]).optional(),
    identity_type: z.enum(["1", "4", "7", "A", "B", "C", "D", "E", "F", "G"]),
    identity_number: text(15),
    name: text(250),
    last_name: text(250).optional(),
    license: z
      .string()
      .regex(/^[A-Z0-9]{9,10}$/)
      .optional(),
  })
  .strict();
export type DespatchDriver = z.infer<typeof despatchDriverSchema>;
export const despatchShipmentSchema = z
  .object({
    transfer_reason_code: z
      .enum(["01", "02", "03", "04", "05", "06", "07", "08", "09", "13", "14", "17", "18", "19"])
      .optional(),
    transfer_reason_text: text(100).optional(),
    transport_mode_code: z.enum(["01", "02"]).optional(),
    gross_weight: weight,
    gross_weight_unit: z.enum(["KGM", "TNE"]),
    selected_items_weight: weight.optional(),
    weight_difference_reason: text(250).optional(),
    total_packages: z.number().int().positive().max(9999999999999).optional(),
    start_date: date,
    start_time: time.optional(),
    handover_date: date.optional(),
    carrier: despatchCarrierSchema.optional(),
    vehicles: z.array(despatchVehicleSchema).max(3).optional(),
    drivers: z.array(despatchDriverSchema).max(3).optional(),
    origin: despatchLocationSchema,
    destination: despatchLocationSchema,
    container_id: text(17).optional(),
    container_seal: text(100).optional(),
    containers: z
      .array(z.object({ id: text(17), seal: text(100).optional() }).strict())
      .max(2)
      .optional(),
    port_code: z
      .string()
      .regex(/^[A-Z0-9]{3}$/)
      .optional(),
    scheduled_transshipment: z.boolean().optional(),
    vehicle_m1_l: z.boolean().optional(),
    return_empty_vehicle: z.boolean().optional(),
    return_empty_packaging: z.boolean().optional(),
    register_carrier_transport: z.boolean().optional(),
    total_customs_transfer: z.boolean().optional(),
    total_goods_transfer: z.boolean().optional(),
    manifest_container_transfer: z.boolean().optional(),
    subcontracted: z.boolean().optional(),
    subcontractor: despatchPartySchema.optional(),
    freight_payer: z.enum(["shipper", "subcontractor", "third_party"]).optional(),
    freight_payer_party: despatchPartySchema.optional(),
    mtc_registration: text(20).optional(),
    authorization: despatchAuthorizationSchema.optional(),
  })
  .strict();
export type DespatchShipment = z.infer<typeof despatchShipmentSchema>;
export const despatchRelatedDocumentSchema = z
  .object({
    document_type: z.enum([
      "01",
      "03",
      "04",
      "09",
      "12",
      "31",
      "48",
      "49",
      "50",
      "52",
      "65",
      "66",
      "67",
      "68",
      "69",
      "71",
      "72",
      "73",
      "74",
      "75",
      "76",
      "77",
      "78",
      "80",
      "81",
      "82",
      "91",
      "92",
      "93",
      "94",
      "95",
    ]),
    serie_number: text(100),
    description: text(120).optional(),
    issuer: despatchPartySchema.optional(),
  })
  .strict();
export type DespatchRelatedDocument = z.infer<typeof despatchRelatedDocumentSchema>;
export const despatchLineSchema = z
  .object({
    id: z.number().int().positive().max(9999),
    quantity: z
      .number()
      .positive()
      .max(999999999999)
      .refine((v) => {
        const [mantissa = "", exponent = "0"] = String(v).split("e");
        return (mantissa.split(".")[1]?.length ?? 0) - Number(exponent) <= 10;
      }, "Maximum 10 decimal places"),
    unit_code: z.string().regex(/^[A-Z0-9]{2,3}$/),
    description: text(500),
    product_code: text(30).optional(),
    sunat_product_code: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
    tariff_heading: z
      .string()
      .regex(/^\d{10}$/)
      .optional(),
    normalized_good: z.boolean().optional(),
    customs_document_number: z
      .string()
      .regex(/^\d{3}-\d{4}-\d{2}-[1-9]\d{0,5}$/)
      .optional(),
    customs_item_number: z
      .string()
      .regex(/^\d{1,4}$/)
      .optional(),
  })
  .strict();
export type DespatchLineCanonical = z.infer<typeof despatchLineSchema>;
export const despatchCanonicalFields = {
  document_type: despatchDocumentTypeSchema,
  serie: z.string().regex(/^[TV][A-Z0-9]{3}$/i),
  number: z.number().int().positive().max(99999999),
  issue_date: date,
  issue_time: time.optional(),
  notes: text(250).optional(),
  supplier: partyCanonicalSchema,
  shipper: despatchPartySchema.optional(),
  delivery_customer: despatchPartySchema,
  supplier_party: despatchPartySchema.optional(),
  buyer: despatchPartySchema.optional(),
  shipment: despatchShipmentSchema,
  related_documents: z.array(despatchRelatedDocumentSchema).max(50).optional(),
  lines: z.array(despatchLineSchema).min(1).max(500),
};
export function validateDespatch(
  v: {
    document_type: DespatchDocumentType;
    serie: string;
    issue_date: string;
    shipper?: z.infer<typeof despatchPartySchema>;
    shipment: DespatchShipment;
    supplier?: PartyCanonical;
    lines: DespatchLineCanonical[];
    related_documents?: DespatchRelatedDocument[];
  },
  ctx: z.RefinementCtx,
): void {
  const s = v.shipment;
  const fail = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const need = (ok: unknown, key: string, message: string) => {
    if (!ok) fail(["shipment", key], message);
  };
  if (!v.serie.toUpperCase().startsWith(v.document_type === "09" ? "T" : "V"))
    fail(["serie"], "Incorrect GRE series prefix");
  if (s.start_date < v.issue_date)
    need(false, "start_date", "Start date must be on or after issue date");
  if (s.handover_date && (s.handover_date < v.issue_date || s.handover_date > s.start_date))
    need(false, "handover_date", "Handover date must be between issue and start dates");
  if (s.return_empty_vehicle && s.return_empty_packaging)
    need(false, "return_empty_vehicle", "Return indicators are mutually exclusive");
  if (s.container_id && s.containers?.length)
    need(false, "containers", "Use container_id or containers, not both");
  if (s.container_seal && !s.container_id) need(false, "container_id", "Seal requires container");
  if (v.document_type === "09") {
    need(s.transfer_reason_code, "transfer_reason_code", "Required for GRE 09");
    need(s.transport_mode_code, "transport_mode_code", "Required for GRE 09");
    if (s.transfer_reason_code === "13")
      need(s.transfer_reason_text, "transfer_reason_text", "Describe motive Otros");
    if (s.transfer_reason_code === "04") {
      need(
        s.origin.establishment_code && s.destination.establishment_code,
        "origin",
        "Transfer between establishments requires both establishment codes",
      );
      if (
        v.supplier &&
        [s.origin.establishment_ruc, s.destination.establishment_ruc].some(
          (ruc) => ruc !== v.supplier?.identity_number,
        )
      )
        need(false, "origin", "Establishments must belong to the issuer");
    }
    if (s.transport_mode_code === "01") {
      need(s.handover_date, "handover_date", "Public transport requires handover date");
      if (!s.vehicle_m1_l) {
        need(s.carrier, "carrier", "Public transport requires carrier");
        if (s.carrier && s.carrier.identity_type !== "6")
          need(false, "carrier", "Carrier must use RUC");
      }
      if (
        !s.register_carrier_transport &&
        !s.vehicle_m1_l &&
        (s.drivers?.length || s.vehicles?.length)
      )
        need(
          false,
          "register_carrier_transport",
          "Indicator required for carrier vehicle/driver details",
        );
    }
    if (s.register_carrier_transport && (s.transport_mode_code !== "01" || s.vehicle_m1_l))
      need(false, "register_carrier_transport", "Only public transport without M1/L");
    if (s.vehicle_m1_l && s.drivers?.length)
      need(false, "drivers", "M1/L must not include driver information");
    if (s.vehicle_m1_l && (s.vehicles?.length ?? 0) > 1)
      need(false, "vehicles", "M1/L must not include secondary vehicles");
    if (s.vehicle_m1_l && s.vehicles?.some((v) => v.tuc || v.authority_code))
      need(false, "vehicles", "M1/L must not include vehicle registration or authorization");
    if (s.transport_mode_code === "02" && s.carrier)
      need(false, "carrier", "Carrier party only applies to public transport");
    if (
      s.subcontracted ||
      s.subcontractor ||
      s.freight_payer ||
      s.freight_payer_party ||
      s.total_goods_transfer
    )
      need(
        false,
        "freight_payer",
        "Subcontracting/freight payer/total goods transfer only apply to GRE 31",
      );
    if (
      ["08", "09"].includes(s.transfer_reason_code ?? "") &&
      !v.related_documents?.some((d) => ["50", "52"].includes(d.document_type))
    )
      fail(["related_documents"], "Import/export requires DAM or DS");
    if (
      s.transfer_reason_code === "19" &&
      !v.related_documents?.some((d) => ["50", "52", "91", "92"].includes(d.document_type))
    )
      fail(["related_documents"], "Foreign goods require DAM, DS, manifest or terminal document");
    if (s.total_customs_transfer && !["08", "09", "19"].includes(s.transfer_reason_code ?? ""))
      need(false, "total_customs_transfer", "Only import/export/foreign goods");
    if (
      s.manifest_container_transfer &&
      (s.transfer_reason_code !== "19" ||
        !v.related_documents?.some((d) => d.document_type === "91"))
    )
      need(false, "manifest_container_transfer", "Requires foreign-goods motive and manifest");
  } else {
    if (!v.shipper) fail(["shipper"], "GRE 31 requires shipper");
    need(s.freight_payer, "freight_payer", "GRE 31 requires freight payer role");
    if (s.subcontracted)
      need(
        s.subcontractor?.identity_type === "6",
        "subcontractor",
        "Subcontracting requires subcontractor RUC",
      );
    if (
      s.subcontractor &&
      v.supplier &&
      s.subcontractor.identity_number === v.supplier.identity_number
    )
      need(false, "subcontractor", "Subcontractor must differ from the issuing carrier");
    if (s.carrier)
      need(
        false,
        "carrier",
        "GRE 31 carrier is the issuing company; use shipment.mtc_registration/authorization",
      );
    if (s.subcontractor && !s.subcontracted)
      need(false, "subcontracted", "Subcontractor requires indicator");
    if (s.freight_payer === "subcontractor" && !s.subcontracted)
      need(false, "freight_payer", "Requires subcontracting");
    if (s.freight_payer === "third_party")
      need(s.freight_payer_party, "freight_payer_party", "Identify third party payer");
    else if (s.freight_payer_party)
      need(false, "freight_payer_party", "Only supply identity for third-party payer");
    if (
      s.vehicle_m1_l ||
      s.total_customs_transfer ||
      s.register_carrier_transport ||
      s.manifest_container_transfer ||
      s.transfer_reason_code ||
      s.transport_mode_code ||
      s.handover_date
    )
      need(false, "transport_mode_code", "Remitente-specific fields do not apply to GRE 31");
  }
  if (
    v.document_type === "31" ||
    (!s.vehicle_m1_l && (s.transport_mode_code === "02" || s.register_carrier_transport))
  ) {
    need(s.vehicles?.length, "vehicles", "Requires a primary vehicle");
    need(s.drivers?.length, "drivers", "Requires a primary driver");
  }
  const plates = new Set<string>(),
    drivers = new Set<string>(),
    ids = new Set<number>();
  s.vehicles?.forEach((x, i) => {
    const plate = x.plate.replace(/-/g, "");
    if (plates.has(plate)) fail(["shipment", "vehicles", i, "plate"], "Duplicate vehicle");
    plates.add(plate);
  });
  s.drivers?.forEach((x, i) => {
    if (x.job_title && x.job_title !== (i === 0 ? "Principal" : "Secundario"))
      fail(["shipment", "drivers", i, "job_title"], "Role must match array position");
    if (!x.license) fail(["shipment", "drivers", i, "license"], "Driver license required");
    if (!x.last_name)
      fail(["shipment", "drivers", i, "last_name"], "Driver family name required separately");
    if (drivers.has(x.identity_number))
      fail(["shipment", "drivers", i, "identity_number"], "Duplicate driver");
    drivers.add(x.identity_number);
  });
  v.lines.forEach((x, i) => {
    if (ids.has(x.id)) fail(["lines", i, "id"], "Duplicate line ID");
    ids.add(x.id);
    if (x.normalized_good && !s.total_customs_transfer && !x.tariff_heading)
      fail(["lines", i, "tariff_heading"], "Normalized good requires tariff heading");
    if (x.normalized_good && !s.total_customs_transfer && !x.sunat_product_code)
      fail(["lines", i, "sunat_product_code"], "Normalized good requires SUNAT product code");
    if (v.document_type === "31" && (x.customs_document_number || x.customs_item_number))
      fail(
        ["lines", i, "customs_document_number"],
        "DAM/DS item references apply to GRE 09; use related_documents in GRE 31",
      );
    if (!!x.customs_document_number !== !!x.customs_item_number)
      fail(
        ["lines", i, "customs_item_number"],
        "Customs document and item number must be supplied together",
      );
    if (
      x.customs_document_number &&
      !v.related_documents?.some(
        (d) =>
          ["50", "52"].includes(d.document_type) && d.serie_number === x.customs_document_number,
      )
    )
      fail(["lines", i, "customs_document_number"], "Reference must match related DAM/DS");
    if (
      v.document_type === "09" &&
      s.transfer_reason_code === "09" &&
      !s.total_customs_transfer &&
      !x.customs_document_number
    )
      fail(
        ["lines", i, "customs_document_number"],
        "Partial export requires DAM/DS and item reference",
      );
  });
  if (
    v.document_type === "31" &&
    (v.related_documents?.length ?? 0) > 1 &&
    !v.related_documents?.some(
      (d) =>
        ["31", "65", "66", "67", "68", "69"].includes(d.document_type) ||
        (d.document_type === "09" && !/^\d/.test(d.serie_number)),
    )
  )
    fail(
      ["related_documents"],
      "Multiple GRE 31 references require an electronic GRE or event GRE",
    );
  v.related_documents?.forEach((d, i) => {
    if (
      ["50", "52"].includes(d.document_type) &&
      !/^\d{3}-\d{4}-\d{2}-[1-9]\d{0,5}$/.test(d.serie_number)
    )
      fail(["related_documents", i, "serie_number"], "Invalid DAM/DS numbering");
    if (["01", "03", "04", "09", "12", "31", "48"].includes(d.document_type) && !d.issuer)
      fail(["related_documents", i, "issuer"], "Identify related document issuer");
  });
  const boxes =
    s.containers ?? (s.container_id ? [{ id: s.container_id, seal: s.container_seal }] : []);
  if (
    s.transfer_reason_code === "09" ||
    (["08", "19"].includes(s.transfer_reason_code ?? "") && s.total_customs_transfer)
  )
    boxes.forEach((box, i) => {
      if (!box.seal)
        fail(["shipment", "containers", i, "seal"], "Customs container requires a seal");
    });
  if (new Set(boxes.map((box) => box.id)).size !== boxes.length)
    need(false, "containers", "Duplicate containers");
}
export const despatchCanonicalSchema = z
  .object(despatchCanonicalFields)
  .strict()
  .superRefine(validateDespatch);
export type DespatchCanonical = z.infer<typeof despatchCanonicalSchema>;
export type { PartyCanonical };
export function assertDespatchCanonical(raw: unknown): DespatchCanonical {
  const parsed = despatchCanonicalSchema.safeParse(raw);
  if (!parsed.success)
    throw ublValidationError("Invalid DespatchCanonical", {
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })),
    });
  return parsed.data;
}
