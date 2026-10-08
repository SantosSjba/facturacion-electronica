import type { Document, Element } from "@xmldom/xmldom";

function children(node: Element, name: string): Element[] {
  return Array.from({ length: node.childNodes.length }, (_, i) => node.childNodes.item(i)).filter(
    (child): child is Element => child?.nodeType === 1 && (child as Element).localName === name,
  );
}
function amount(node: Element, name: string): number | null {
  const text = children(node, name)[0]?.textContent?.trim();
  return text && Number.isFinite(Number(text)) ? Number(text) : null;
}
function close(a: number, b: number): boolean {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= 1;
}

/** Check direct document amounts against every line, including noncollectible free tax. */
export function checkCpeAmounts(doc: Document): string[] {
  const root = doc.documentElement;
  if (!root) return ["Missing document root"];
  const issues: string[] = [];
  const monetary =
    children(root, "LegalMonetaryTotal")[0] ?? children(root, "RequestedMonetaryTotal")[0];
  const tax = children(root, "TaxTotal")[0];
  if (!monetary || !tax) return ["Missing monetary totals or TaxTotal"];
  const base = amount(monetary, "LineExtensionAmount");
  const payable = amount(monetary, "PayableAmount");
  const inclusive = amount(monetary, "TaxInclusiveAmount");
  const taxAmount = amount(tax, "TaxAmount");
  if (base == null || payable == null || inclusive == null || taxAmount == null)
    return ["Missing LineExtensionAmount, TaxInclusiveAmount, TaxAmount or PayableAmount"];
  let freeTax = 0;
  let subtotalTax = 0;
  for (const sub of children(tax, "TaxSubtotal")) {
    const value = amount(sub, "TaxAmount");
    if (value == null) {
      issues.push("Missing subtotal TaxAmount");
      continue;
    }
    subtotalTax += value;
    const category = children(sub, "TaxCategory")[0];
    const scheme = category && children(category, "TaxScheme")[0];
    if (scheme && children(scheme, "ID")[0]?.textContent === "9996") freeTax += value;
  }
  if (!close(subtotalTax, taxAmount))
    issues.push("Document TaxAmount does not match tax subtotals");
  if (!close(base + taxAmount - freeTax, inclusive) || !close(inclusive, payable)) {
    issues.push("PayableAmount does not match collectible base plus taxes (free tax excluded)");
  }
  const lines = ["InvoiceLine", "CreditNoteLine", "DebitNoteLine"].flatMap((name) =>
    children(root, name),
  );
  let lineBase = 0;
  let lineTax = 0;
  for (const line of lines) {
    const value = amount(line, "LineExtensionAmount");
    const lineTaxNode = children(line, "TaxTotal")[0];
    const taxValue = lineTaxNode && amount(lineTaxNode, "TaxAmount");
    if (value == null || taxValue == null) {
      issues.push("Missing line base or tax");
      continue;
    }
    lineBase += value;
    lineTax += taxValue;
  }
  if (!lines.length || !close(lineBase, base))
    issues.push("Document base does not match the sum of all lines");
  if (!close(lineTax, taxAmount)) issues.push("Document tax does not match the sum of all lines");
  return issues;
}
