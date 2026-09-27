import { z } from "zod";

export const apiKeyFormSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(80, "Máximo 80 caracteres"),
  scopes: z.array(z.string()).min(1, "Selecciona al menos un scope"),
});

export const webhookFormSchema = z.object({
  url: z
    .string()
    .trim()
    .url("URL inválida")
    .refine((v) => v.startsWith("https://"), "La URL debe ser https://"),
  events: z.array(z.string()).min(1, "Selecciona al menos un evento"),
});

export const cpeValidationSchema = z.object({
  company_id: z.string().uuid("Selecciona una empresa"),
  ruc: z.string().regex(/^\d{11}$/, "RUC debe tener 11 dígitos"),
  document_type: z.string().min(1),
  serie: z.string().trim().min(1, "Serie requerida"),
  number: z.string().trim().min(1, "Número requerido"),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  total_amount: z.number().min(0, "Monto inválido"),
});

export function zodFieldErrors(result: {
  success: boolean;
  error?: { issues: Array<{ message: string; path: PropertyKey[] }> };
}): Record<string, string> {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
