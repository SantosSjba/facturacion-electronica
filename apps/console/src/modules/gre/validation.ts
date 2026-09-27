import { z } from "zod";

export const greHeaderSchema = z.object({
  company_id: z.string().uuid("Selecciona una empresa"),
  serie: z
    .string()
    .min(1, "Selecciona una serie")
    .regex(/^[A-Za-z0-9]{4}$/, "Serie de 4 caracteres"),
});

export const grePartySchema = z
  .object({
    identity_type: z.string().min(1),
    identity_number: z.string().min(1, "Número de documento requerido"),
    name: z.string().trim().min(2, "Nombre requerido"),
  })
  .superRefine((data, ctx) => {
    if (data.identity_type === "6" && !/^\d{11}$/.test(data.identity_number)) {
      ctx.addIssue({
        code: "custom",
        path: ["identity_number"],
        message: "El RUC debe tener 11 dígitos",
      });
    }
    if (data.identity_type === "1" && !/^\d{8}$/.test(data.identity_number)) {
      ctx.addIssue({
        code: "custom",
        path: ["identity_number"],
        message: "El DNI debe tener 8 dígitos",
      });
    }
  });

export const greLineSchema = z.object({
  description: z.string().trim().min(1, "Descripción requerida"),
  quantity: z.number().positive("Cantidad debe ser mayor a cero"),
  unit_code: z.string().min(1, "Unidad requerida"),
});

function firstMsg(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}): string | null {
  if (result.success) return null;
  return result.error?.issues[0]?.message ?? "Revisa el formulario";
}

type Party = {
  identity_type: string;
  identity_number: string;
  name: string;
};

type Shipment = {
  transfer_reason_code?: string;
  transport_mode_code?: string;
  gross_weight: number;
  origin: { ubigeo: string; address: string };
  destination: { ubigeo: string; address: string };
  carrier?: { identity_number?: string; name?: string } | null;
  vehicles?: Array<{ plate?: string }> | null;
  drivers?: Array<{
    identity_number?: string;
    name?: string;
    license?: string;
  }> | null;
};

function shipmentError(
  s: Shipment,
  opts: { requireCarrierPrivate: boolean; requireLicense: boolean },
): string | null {
  if (!s.transfer_reason_code && opts.requireCarrierPrivate) {
    // 31 may omit reason differently — still require locations/weight
  }
  if (opts.requireCarrierPrivate && !s.transfer_reason_code) {
    return "Motivo de traslado requerido";
  }
  if (opts.requireCarrierPrivate && !s.transport_mode_code) {
    return "Modalidad de transporte requerida";
  }
  if (s.gross_weight <= 0) return "Peso bruto debe ser mayor a cero";
  if (!s.origin.ubigeo || !s.origin.address) {
    return "Completa ubigeo y dirección de origen";
  }
  if (!s.destination.ubigeo || !s.destination.address) {
    return "Completa ubigeo y dirección de destino";
  }
  if (opts.requireCarrierPrivate && s.transport_mode_code === "01") {
    if (!s.carrier?.identity_number || !s.carrier?.name) {
      return "Completa datos del transportista (RUC y razón social)";
    }
  }
  if (
    (opts.requireCarrierPrivate && s.transport_mode_code === "02") ||
    !opts.requireCarrierPrivate
  ) {
    if (!s.vehicles?.[0]?.plate) return "Placa del vehículo requerida";
    if (!s.drivers?.[0]?.identity_number || !s.drivers?.[0]?.name) {
      return "Completa datos del conductor";
    }
    if (opts.requireLicense && !s.drivers?.[0]?.license) {
      return "Licencia del conductor requerida";
    }
  }
  return null;
}

function linesError(
  lines: Array<{ description: string; quantity: number; unit_code: string }>,
): string | null {
  if (lines.length < 1) return "Agrega al menos una línea";
  for (const line of lines) {
    const msg = firstMsg(greLineSchema.safeParse(line));
    if (msg) return msg;
  }
  return null;
}

/** GRE 09 steps: Cabecera, Destinatario, Traslado, Líneas, Revisión */
export function gre09StepError(
  step: number,
  input: {
    header: { company_id: string; serie: string };
    delivery: Party;
    shipment: Shipment;
    lines: Array<{ description: string; quantity: number; unit_code: string }>;
  },
): string | null {
  if (step === 0) {
    const parsed = greHeaderSchema.safeParse({
      company_id: input.header.company_id || undefined,
      serie: input.header.serie,
    });
    if (!parsed.success) return firstMsg(parsed);
    if (!/^T/i.test(input.header.serie)) {
      return "La serie de GRE remitente debe empezar con T (ej. T001)";
    }
    return null;
  }
  if (step === 1) return firstMsg(grePartySchema.safeParse(input.delivery));
  if (step === 2) {
    return shipmentError(input.shipment, {
      requireCarrierPrivate: true,
      requireLicense: false,
    });
  }
  if (step === 3) return linesError(input.lines);
  return null;
}

/** GRE 31 steps: Cabecera, Remitente, Destinatario, Traslado, Líneas, Revisión */
export function gre31StepError(
  step: number,
  input: {
    header: { company_id: string; serie: string };
    shipper: Party;
    delivery: Party;
    shipment: Shipment;
    lines: Array<{ description: string; quantity: number; unit_code: string }>;
  },
): string | null {
  if (step === 0) {
    const parsed = greHeaderSchema.safeParse({
      company_id: input.header.company_id || undefined,
      serie: input.header.serie,
    });
    if (!parsed.success) return firstMsg(parsed);
    if (!/^V/i.test(input.header.serie)) {
      return "La serie de GRE transportista debe empezar con V (ej. V001)";
    }
    return null;
  }
  if (step === 1) return firstMsg(grePartySchema.safeParse(input.shipper));
  if (step === 2) return firstMsg(grePartySchema.safeParse(input.delivery));
  if (step === 3) {
    return shipmentError(input.shipment, {
      requireCarrierPrivate: false,
      requireLicense: true,
    });
  }
  if (step === 4) return linesError(input.lines);
  return null;
}
