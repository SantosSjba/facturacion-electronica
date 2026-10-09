import { DOMParser, type Element } from "@xmldom/xmldom";
import { extractDigestValue, type QrPayloadInput } from "./build-qr-payload";

function children(node: Element | null, name: string): Element[] {
  return Array.from(node?.childNodes ?? []).filter(
    (n) => n.nodeType === 1 && n.localName === name,
  ) as Element[];
}
function child(node: Element | null, name: string): Element | null {
  return children(node, name)[0] ?? null;
}
function text(node: Element | null, name: string): string {
  return child(node, name)?.textContent?.trim() ?? "";
}
function parse(xml: string): Element {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("XML declarations with entities are not supported");
  const document = new DOMParser().parseFromString(xml, "text/xml");
  if (!document.documentElement) throw new Error("Invalid XML");
  return document.documentElement;
}

/** The QR amount/date/ID come from the definitive signed XML, never mutable company data. */
export function readSignedCpeQr(xml: string): QrPayloadInput | null {
  const root = parse(xml);
  const type = (
    { Invoice: text(root, "InvoiceTypeCode"), CreditNote: "07", DebitNote: "08" } as Record<
      string,
      string
    >
  )[root.localName ?? ""];
  if (!type) return null;
  const id = text(root, "ID");
  const split = id.lastIndexOf("-");
  const supplier = child(child(root, "AccountingSupplierParty"), "Party");
  const customer = child(child(root, "AccountingCustomerParty"), "Party");
  const supplierId = child(child(supplier, "PartyIdentification"), "ID");
  const customerId = child(child(customer, "PartyIdentification"), "ID");
  const monetary = child(root, "LegalMonetaryTotal") ?? child(root, "RequestedMonetaryTotal");
  const igv = children(root, "TaxTotal")
    .flatMap((total) => children(total, "TaxSubtotal"))
    .filter((sub) => text(child(child(sub, "TaxCategory"), "TaxScheme"), "ID") === "1000")
    .reduce((sum, sub) => sum + Number(text(sub, "TaxAmount")), 0);
  const digest = extractDigestValue(xml);
  if (split < 1 || !supplierId?.textContent || !digest || !text(monetary, "PayableAmount"))
    throw new Error("Signed CPE XML is missing QR fields");
  return {
    ruc: supplierId.textContent.trim(),
    documentType: type,
    serie: id.slice(0, split),
    number: id.slice(split + 1),
    igv: igv.toFixed(2),
    total: text(monetary, "PayableAmount"),
    issueDate: text(root, "IssueDate"),
    customerIdentityType: customerId?.getAttribute("schemeID") ?? "",
    customerIdentityNumber: customerId?.textContent?.trim() ?? "",
    digestValue: digest,
  };
}

/** Legacy RC/RA without a canonical snapshot can still render from their signed XML. */
export function readSummaryXml(xml: string): Record<string, unknown> {
  const root = parse(xml);
  if (!["SummaryDocuments", "VoidedDocuments"].includes(root.localName ?? ""))
    throw new Error("Expected RC/RA XML");
  const supplier = child(root, "AccountingSupplierParty");
  const rows = children(
    root,
    root.localName === "SummaryDocuments" ? "SummaryDocumentsLine" : "VoidedDocumentsLine",
  );
  return {
    id: text(root, "ID"),
    reference_date: text(root, "ReferenceDate"),
    issue_date: text(root, "IssueDate"),
    supplier: {
      identity_number: text(supplier, "CustomerAssignedAccountID"),
      name: text(child(child(supplier, "Party"), "PartyLegalEntity"), "RegistrationName"),
    },
    lines: rows.map((row) => {
      const totals: Record<string, number> = {};
      for (const payment of children(row, "BillingPayment")) {
        const key = (
          { "01": "gravadas", "02": "exoneradas", "03": "inafectas", "05": "gratuitas" } as Record<
            string,
            string
          >
        )[text(payment, "InstructionID")];
        if (key) totals[key] = Number(text(payment, "PaidAmount"));
      }
      for (const tax of children(row, "TaxTotal"))
        for (const sub of children(tax, "TaxSubtotal")) {
          const key = (
            { "1000": "igv", "1016": "ivap", "2000": "isc", "7152": "icbper" } as Record<
              string,
              string
            >
          )[text(child(child(sub, "TaxCategory"), "TaxScheme"), "ID")];
          if (key) totals[key] = (totals[key] ?? 0) + Number(text(sub, "TaxAmount"));
        }
      const reference = child(child(row, "BillingReference"), "InvoiceDocumentReference");
      const customer = child(row, "AccountingCustomerParty");
      totals["payable"] = Number(text(row, "TotalAmount"));
      return {
        document_type: text(row, "DocumentTypeCode"),
        serie_number:
          text(row, "ID") || `${text(row, "DocumentSerialID")}-${text(row, "DocumentNumberID")}`,
        status: text(child(row, "Status"), "ConditionCode"),
        reason: text(row, "VoidReasonDescription"),
        customer: {
          identity_type: text(customer, "AdditionalAccountID"),
          identity_number: text(customer, "CustomerAssignedAccountID"),
        },
        ...(root.localName === "SummaryDocuments" ? { totals } : {}),
        ...(reference ? { affected_document: { serie_number: text(reference, "ID") } } : {}),
      };
    }),
  };
}
