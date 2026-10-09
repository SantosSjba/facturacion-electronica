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
  const lines = ["InvoiceLine", "CreditNoteLine", "DebitNoteLine"].flatMap((name) =>
    children(root, name),
  );
  let lineBase = 0;
  let lineTax = 0;
  let freeIsc = 0;
  let itemNonTaxAdjustment = 0;
  for (const line of lines) {
    const value = amount(line, "LineExtensionAmount");
    const lineTaxNode = children(line, "TaxTotal")[0];
    const taxValue = lineTaxNode && amount(lineTaxNode, "TaxAmount");
    if (value == null || taxValue == null || !lineTaxNode) {
      issues.push("Missing line base or tax");
      continue;
    }
    lineBase += value;
    lineTax += taxValue;
    const groups = children(lineTaxNode, "TaxSubtotal");
    const schemeOf = (sub: Element) =>
      sub.getElementsByTagName("cac:TaxScheme")[0]?.getElementsByTagName("cbc:ID")[0]?.textContent;
    if (groups.some((sub) => schemeOf(sub) === "9996"))
      freeIsc += groups
        .filter((sub) => schemeOf(sub) === "2000")
        .reduce((sum, sub) => sum + (amount(sub, "TaxAmount") ?? 0), 0);
    for (const a of children(line, "AllowanceCharge")) {
      const code = children(a, "AllowanceChargeReasonCode")[0]?.textContent ?? "";
      if (["01", "48"].includes(code))
        itemNonTaxAdjustment += (code === "48" ? 1 : -1) * (amount(a, "Amount") ?? 0);
    }
  }

  let globalAdjustment = 0,
    globalTaxAdjustment = 0,
    prepaidBase = 0;
  for (const a of children(root, "AllowanceCharge")) {
    const code = children(a, "AllowanceChargeReasonCode")[0]?.textContent ?? "";
    const value = amount(a, "Amount") ?? 0;
    const charge = children(a, "ChargeIndicator")[0]?.textContent === "true";
    if (["04", "05", "06"].includes(code)) prepaidBase += value;
    else if (["02", "49"].includes(code)) globalAdjustment += (charge ? 1 : -1) * value;
    if (["02", "04", "49"].includes(code)) {
      const category = children(a, "TaxCategory")[0];
      const percent = category ? (amount(category, "Percent") ?? 0) : 0;
      globalTaxAdjustment += ((charge ? 1 : -1) * Math.round(value * percent)) / 100;
    }
    if (code === "20") {
      globalTaxAdjustment -= value;
      const related = children(a, "TaxCategory")[1];
      if (related)
        globalTaxAdjustment -= Math.round(value * (amount(related, "Percent") ?? 0)) / 100;
    }
  }
  const prepaid = amount(monetary, "PrepaidAmount") ?? 0;
  const paidSum = children(root, "PrepaidPayment").reduce(
    (sum, p) => sum + (amount(p, "PaidAmount") ?? 0),
    0,
  );
  if (!close(prepaid, paidSum)) issues.push("PrepaidAmount does not match payments");
  const advanceTax = prepaid - prepaidBase;
  if (!lines.length || !close(lineBase + globalAdjustment, base))
    issues.push("Document base does not match all lines and global taxable adjustments");
  const nonTaxGlobal = children(root, "AllowanceCharge")
    .filter((a) =>
      ["03", "46", "50"].includes(children(a, "AllowanceChargeReasonCode")[0]?.textContent ?? ""),
    )
    .reduce(
      (sum, a) =>
        sum +
        (children(a, "ChargeIndicator")[0]?.textContent === "true" ? 1 : -1) *
          (amount(a, "Amount") ?? 0),
      0,
    );
  const charges = amount(monetary, "ChargeTotalAmount") ?? 0,
    allowances = amount(monetary, "AllowanceTotalAmount") ?? 0;
  if (!close(charges - allowances, nonTaxGlobal + itemNonTaxAdjustment))
    issues.push("Non-tax monetary adjustments do not match item/global adjustments");
  if (
    !close(base + taxAmount - freeTax + advanceTax, inclusive) ||
    !close(inclusive + charges - allowances - prepaid, payable)
  )
    issues.push("PayableAmount does not match fiscal price, non-tax adjustments and advances");
  if (!close(lineTax - freeIsc + globalTaxAdjustment, taxAmount))
    issues.push("Document tax does not match the sum of all lines and global adjustments");
  return issues;
}
