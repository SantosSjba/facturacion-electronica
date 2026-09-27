import { z } from "zod";

/** Aligned with API invoice/receipt/note create schemas. */
export const headerStepSchema = z.object({
  company_id: z
    .string()
    .min(1, "Selecciona una empresa")
    .uuid("Empresa inválida"),
  serie: z
    .string()
    .min(1, "Selecciona una serie")
    .regex(/^[A-Za-z0-9]{4}$/, "Serie de 4 caracteres (ej. F001)"),
  number: z
    .string()
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1),
      "Número debe ser entero positivo",
    ),
  operation_type: z
    .string()
    .regex(/^\d{4}$/, "Tipo de operación: 4 dígitos")
    .optional()
    .or(z.literal("")),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de emisión inválida"),
  currency: z.string().length(3, "Moneda inválida"),
});

export const customerStepSchema = z
  .object({
    identity_type: z.string().min(1, "Tipo de documento requerido"),
    identity_number: z.string().min(1, "Número de documento requerido"),
    name: z
      .string()
      .trim()
      .min(2, "Ingresa el nombre o razón social")
      .max(250, "Máximo 250 caracteres"),
    email: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || z.string().email().safeParse(v).success,
        "Email inválido",
      ),
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

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Descripción requerida"),
  quantity: z.number().positive("Cantidad debe ser mayor a cero"),
  unit_code: z.string().min(1, "Unidad requerida"),
  unit_value: z.number().min(0, "Valor unitario inválido"),
});

export const linesStepSchema = z
  .array(lineItemSchema)
  .min(1, "Agrega al menos una línea");

export const noteAffectedSchema = z.object({
  reason: z.string().trim().min(1, "Motivo requerido"),
  affected_serie_number: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{1,4}-\d+$/,
      "Formato esperado: F001-1",
    ),
});

export const voidedFormSchema = z.object({
  company_id: z
    .string()
    .min(1, "Selecciona una empresa")
    .uuid("Empresa inválida"),
  reference_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de referencia inválida"),
  documents: z
    .array(
      z.object({
        document_type: z.string().min(1),
        serie_number: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{1,4}-\d+$/, "Formato: F001-1"),
        reason: z.string().trim().min(1, "Motivo requerido"),
      }),
    )
    .min(1, "Agrega al menos un documento"),
});

export const dailySummaryFormSchema = z.object({
  company_id: z
    .string()
    .min(1, "Selecciona una empresa")
    .uuid("Empresa inválida"),
  reference_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de referencia inválida"),
});

export function firstZodMessage(result: {
  success: boolean;
  error?: { issues: Array<{ message: string; path: PropertyKey[] }> };
}): string | null {
  if (result.success) return null;
  return result.error?.issues[0]?.message ?? "Revisa el formulario";
}

export function zodFieldErrors<T extends string>(result: {
  success: boolean;
  error?: { issues: Array<{ message: string; path: PropertyKey[] }> };
}): Partial<Record<T, string>> {
  if (result.success) return {};
  const out: Partial<Record<T, string>> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = String(issue.path[0] ?? "") as T;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export function wizardCommonStepError(
  step: number,
  input: {
    header: {
      company_id: string;
      serie: string;
      number: string;
      operation_type: string;
      issue_date: string;
      currency: string;
    };
    customer: {
      identity_type: string;
      identity_number: string;
      name: string;
      email?: string;
    };
    lines: Array<{
      description: string;
      quantity: number;
      unit_code: string;
      unit_value: number;
    }>;
    seriePrefix?: RegExp;
    serieHint?: string;
    affected?: { reason: string; affected_serie_number: string };
    affectedStep?: number;
  },
): string | null {
  if (step === 0) {
    const parsed = headerStepSchema.safeParse({
      company_id: input.header.company_id,
      serie: input.header.serie,
      number: input.header.number,
      operation_type: input.header.operation_type || "0101",
      issue_date: input.header.issue_date,
      currency: input.header.currency,
    });
    if (!parsed.success) return firstZodMessage(parsed);
    if (input.seriePrefix && !input.seriePrefix.test(input.header.serie)) {
      return input.serieHint ?? "Serie no válida para este tipo de documento";
    }
    return null;
  }
  if (step === 1) {
    return firstZodMessage(
      customerStepSchema.safeParse({
        identity_type: input.customer.identity_type,
        identity_number: input.customer.identity_number,
        name: input.customer.name,
        email: input.customer.email ?? "",
      }),
    );
  }
  if (step === 2) {
    return firstZodMessage(linesStepSchema.safeParse(input.lines));
  }
  if (
    input.affected &&
    input.affectedStep != null &&
    step === input.affectedStep
  ) {
    return firstZodMessage(noteAffectedSchema.safeParse(input.affected));
  }
  return null;
}
