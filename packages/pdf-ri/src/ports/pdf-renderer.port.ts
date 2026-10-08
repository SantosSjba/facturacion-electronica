export type PdfDocumentType = "01" | "03" | "07" | "08";

export interface PdfLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  igv: string;
  amount: string;
  productCode?: string;
  sunatProductCode?: string;
}

export interface PdfRenderInput {
  documentType: PdfDocumentType;
  serieNumber: string;
  issueDate: string;
  issueTime?: string;
  dueDate?: string;
  purchaseOrder?: string;
  legends?: { code: string; text: string }[];
  currency: string;
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
  };
  digestValue: string;
  qrPayload: string;
  noteReason?: string;
  affectedSerieNumber?: string;
}

export interface PdfRendererPort {
  render(input: PdfRenderInput): Promise<Uint8Array>;
}
