/** Starter series aligned with sandbox checklist (RA/RC are date-based). */
export const DEFAULT_COMPANY_SERIES = [
  { document_type: "01", serie: "F001", label: "Factura" },
  { document_type: "03", serie: "B001", label: "Boleta" },
  { document_type: "07", serie: "FC01", label: "Nota de crédito" },
  { document_type: "08", serie: "FD01", label: "Nota de débito" },
  { document_type: "09", serie: "T001", label: "GRE remitente" },
  { document_type: "31", serie: "V001", label: "GRE transportista" },
] as const;
