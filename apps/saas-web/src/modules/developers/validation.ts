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

export function zodFieldErrors(result: {
  success: boolean;
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}): Record<string, string> {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
