export type PdfDocumentType =
  "01" | "03" | "07" | "08" | "RC" | "RA" | "09" | "31" | "20" | "40" | "RR";

export interface PdfLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  igv: string;
  amount: string;
  productCode?: string;
  sunatProductCode?: string;
  details?: string[];
  isc?: string;
  icbper?: string;
}

export type PdfFormat = "A4" | "A5" | "TICKET80" | "TICKET58";
export const PDF_TEMPLATE_VERSION = "ri-v2";

export interface PdfRenderInput {
  format?: PdfFormat;
  templateVersion?: string;
  preview?: boolean;
  observations?: string;
  informational?: boolean;
  taxAgent?: boolean;
  qrDataUrl?: string;
  qrSizeMm?: number;
  documentType: PdfDocumentType;
  serieNumber: string;
  issueDate: string;
  issueTime?: string;
  dueDate?: string;
  purchaseOrder?: string;
  legends?: { code: string; text: string }[];
  currency: string;
  commercialSections?: { title: string; entries: { label: string; value: string }[] }[];
  issuer: {
    ruc: string;
    legalName: string;
    address?: string;
    logoDataUrl?: string;
  };
  customer: {
    identityType: string;
    identityNumber: string;
    name: string;
    address?: string;
    email?: string;
  };
  lines: PdfLineItem[];
  totals: {
    gravado?: string;
    igv?: string;
    total: string;
    exempt?: string;
    unaffected?: string;
    export?: string;
    free?: string;
    freeTax?: string;
    isc?: string;
    icbper?: string;
    ivap?: string;
    prepaid?: string;
    gross?: string;
    discounts?: string;
    charges?: string;
  };
  digestValue: string;
  qrPayload: string;
  noteReason?: string;
  affectedSerieNumber?: string;
}

export interface PdfRendererPort {
  render(input: PdfRenderInput): Promise<Uint8Array>;
}
