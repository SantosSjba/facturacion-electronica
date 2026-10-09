import { retentionInputSchema, perceptionInputSchema } from "../src/index";
export const AGENT = {
  identity_type: "6" as const,
  identity_number: "20100070970",
  name: "AGENTE DE PRUEBA",
};
export function taxAgentRequest(
  type: "20" | "40",
  currency: "PEN" | "USD" = "PEN",
  regime: "01" | "02" | "03" = "01",
) {
  return (type === "20" ? retentionInputSchema : perceptionInputSchema).parse({
    serie: type === "20" ? "R001" : "P001",
    issue_date: "2026-10-08",
    regime,
    ...(type === "40" && regime === "03" ? { customer_is_perception_agent: true } : {}),
    customer: { identity_type: "6", identity_number: "20131312955", name: "CONTRAPARTE DE PRUEBA" },
    documents: [
      {
        document_type: "01",
        serie_number: "F001-00000001",
        issue_date: "2026-10-01",
        currency,
        total_amount: 1180,
        payments: [
          {
            number: 1,
            date: "2026-10-08",
            amount: 1180,
            ...(currency === "USD"
              ? { exchange_rate: { source_currency: "USD", rate: 3.75, date: "2026-10-08" } }
              : {}),
          },
        ],
      },
    ],
  });
}
