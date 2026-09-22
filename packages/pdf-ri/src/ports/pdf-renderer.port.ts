export type PdfDocumentType = "01" | "03" | "07" | "08";

export interface PdfLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  igv: string;
  amount: string;
}

export interface PdfRenderInput {
  documentType: PdfDocumentType;
  serieNumber: string;
  issueDate: string;
  currency: string;
  issuer: {
    ruc: string;
    legalName: string;
    address?: string;
  };
  customer: {
    identityType: string;
    identityNumber: string;
    name: string;
  };
  lines: PdfLineItem[];
  totals: {
    gravado?: string;
    igv?: string;
    total: string;
  };
  digestValue: string;
  qrPayload: string;
  noteReason?: string;
  affectedSerieNumber?: string;
}

export interface PdfRendererPort {
  render(input: PdfRenderInput): Promise<Uint8Array>;
}
