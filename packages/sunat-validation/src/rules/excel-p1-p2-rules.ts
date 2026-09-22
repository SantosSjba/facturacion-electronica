import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import type { CatalogPort } from "@factosys/sunat-catalogs";
import { JsonCatalogAdapter } from "@factosys/sunat-catalogs";

import type { SunatValidationIssue } from "../ports/sunat-validation.port";
import { isObsMigratedToError } from "./obs-to-error";
import { P0_SUNAT_CODES, runP0InvoiceRules } from "./p0-invoice-rules";

export const P1_SUNAT_CODES = P0_SUNAT_CODES;
export const P2_SUNAT_CODES = P0_SUNAT_CODES;

function findFirstByLocalName(
  parent: Element | Document,
  localName: string,
): Element | null {
  const nodes = parent.getElementsByTagName("*");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.item(i);
    if (!el) continue;
    if (
      el.localName === localName ||
      el.nodeName === localName ||
      el.nodeName.endsWith(`:${localName}`)
    ) {
      return el;
    }
  }
  return null;
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").trim();
}

function money(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function issue(
  sunatCode: string,
  message: string,
  path?: string,
): SunatValidationIssue {
  void isObsMigratedToError(sunatCode);
  return {
    severity: "error",
    stage: "excel",
    sunatCode,
    message,
    path,
  };
}

function documentRootId(doc: Document): string {
  const root = doc.documentElement;
  if (!root) return "";
  for (let i = 0; i < root.childNodes.length; i++) {
    const n = root.childNodes.item(i);
    if (!n || n.nodeType !== 1) continue;
    const el = n as Element;
    if (
      el.localName === "ID" ||
      el.nodeName === "ID" ||
      el.nodeName.endsWith(":ID")
    ) {
      return textOf(el);
    }
  }
  return "";
}

export interface ExcelRuleContext {
  catalogs?: CatalogPort;
}

/**
 * Excel P1 critical checks for Boleta 03 (B###-########, InvoiceTypeCode 03).
 */
export async function runP1BoletaRules(
  xml: string,
  ctx: ExcelRuleContext = {},
): Promise<SunatValidationIssue[]> {
  const catalogs = ctx.catalogs ?? new JsonCatalogAdapter();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const issues: SunatValidationIssue[] = [];

  const rootName = doc.documentElement?.localName ?? "";
  if (rootName !== "Invoice") {
    issues.push(
      issue(
        P1_SUNAT_CODES.serieNumero,
        `Boleta root must be Invoice (got '${rootName || "(empty)"}')`,
      ),
    );
  }

  const typeCode = textOf(findFirstByLocalName(doc, "InvoiceTypeCode"));
  if (typeCode !== "03") {
    issues.push(
      issue(
        P1_SUNAT_CODES.serieNumero,
        `InvoiceTypeCode must be 03 for boleta (got '${typeCode || "(empty)"}')`,
        "cbc:InvoiceTypeCode",
      ),
    );
  }

  const supplierParty = findFirstByLocalName(doc, "AccountingSupplierParty");
  const supplierId = supplierParty
    ? findFirstByLocalName(supplierParty, "ID")
    : null;
  const ruc = textOf(supplierId);
  if (!/^\d{11}$/.test(ruc)) {
    issues.push(
      issue(
        P1_SUNAT_CODES.ruc,
        `Supplier RUC must be 11 digits (got '${ruc || "(empty)"}')`,
        "cac:AccountingSupplierParty//cbc:ID",
      ),
    );
  }

  const invoiceId = documentRootId(doc);
  if (!/^B[A-Z0-9]{3}-\d{8}$/i.test(invoiceId)) {
    issues.push(
      issue(
        P1_SUNAT_CODES.serieNumero,
        `Boleta ID must match B###-######## (got '${invoiceId || "(empty)"}')`,
        "cbc:ID",
      ),
    );
  }

  const currency = textOf(findFirstByLocalName(doc, "DocumentCurrencyCode"));
  if (!currency || !(await catalogs.hasCode("02", currency))) {
    issues.push(
      issue(
        P1_SUNAT_CODES.moneda,
        `DocumentCurrencyCode '${currency || "(empty)"}' is not in catalog 02`,
        "cbc:DocumentCurrencyCode",
      ),
    );
  }

  appendTotalsCheck(doc, issues);
  return issues;
}

/**
 * Excel P2 critical checks for NC 07 / ND 08.
 */
export async function runP2NoteRules(
  xml: string,
  documentType: "07" | "08",
  ctx: ExcelRuleContext = {},
): Promise<SunatValidationIssue[]> {
  const catalogs = ctx.catalogs ?? new JsonCatalogAdapter();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const issues: SunatValidationIssue[] = [];

  const expectedRoot = documentType === "07" ? "CreditNote" : "DebitNote";
  const rootName = doc.documentElement?.localName ?? "";
  if (rootName !== expectedRoot) {
    issues.push(
      issue(
        P2_SUNAT_CODES.serieNumero,
        `Root must be ${expectedRoot} (got '${rootName || "(empty)"}')`,
      ),
    );
  }

  const supplierParty = findFirstByLocalName(doc, "AccountingSupplierParty");
  const supplierId = supplierParty
    ? findFirstByLocalName(supplierParty, "ID")
    : null;
  const ruc = textOf(supplierId);
  if (!/^\d{11}$/.test(ruc)) {
    issues.push(
      issue(
        P2_SUNAT_CODES.ruc,
        `Supplier RUC must be 11 digits (got '${ruc || "(empty)"}')`,
        "cac:AccountingSupplierParty//cbc:ID",
      ),
    );
  }

  const noteId = documentRootId(doc);
  if (!/^[FB][A-Z0-9]{3}-\d{8}$/i.test(noteId)) {
    issues.push(
      issue(
        P2_SUNAT_CODES.serieNumero,
        `Note ID must match F###|B###-######## (got '${noteId || "(empty)"}')`,
        "cbc:ID",
      ),
    );
  }

  const discrepancy = findFirstByLocalName(doc, "DiscrepancyResponse");
  if (!discrepancy) {
    issues.push(
      issue(
        P2_SUNAT_CODES.serieNumero,
        "Missing cac:DiscrepancyResponse",
        "cac:DiscrepancyResponse",
      ),
    );
  } else {
    const responseCode = textOf(findFirstByLocalName(discrepancy, "ResponseCode"));
    if (!responseCode) {
      issues.push(
        issue(
          P2_SUNAT_CODES.serieNumero,
          "Missing DiscrepancyResponse ResponseCode (note_type)",
          "cac:DiscrepancyResponse/cbc:ResponseCode",
        ),
      );
    }
    const refId = textOf(findFirstByLocalName(discrepancy, "ReferenceID"));
    if (!refId) {
      issues.push(
        issue(
          P2_SUNAT_CODES.serieNumero,
          "Missing DiscrepancyResponse ReferenceID",
          "cac:DiscrepancyResponse/cbc:ReferenceID",
        ),
      );
    }
  }

  const billing = findFirstByLocalName(doc, "BillingReference");
  if (!billing) {
    issues.push(
      issue(
        P2_SUNAT_CODES.serieNumero,
        "Missing cac:BillingReference",
        "cac:BillingReference",
      ),
    );
  }

  const currency = textOf(findFirstByLocalName(doc, "DocumentCurrencyCode"));
  if (!currency || !(await catalogs.hasCode("02", currency))) {
    issues.push(
      issue(
        P2_SUNAT_CODES.moneda,
        `DocumentCurrencyCode '${currency || "(empty)"}' is not in catalog 02`,
        "cbc:DocumentCurrencyCode",
      ),
    );
  }

  appendTotalsCheck(doc, issues);
  return issues;
}

function appendTotalsCheck(
  doc: Document,
  issues: SunatValidationIssue[],
): void {
  const legal =
    findFirstByLocalName(doc, "LegalMonetaryTotal") ??
    findFirstByLocalName(doc, "RequestedMonetaryTotal");
  const lineExt = money(
    textOf(legal ? findFirstByLocalName(legal, "LineExtensionAmount") : null),
  );
  const docTaxTotal = findFirstByLocalName(doc, "TaxTotal");
  const taxAmount = money(
    textOf(
      docTaxTotal ? findFirstByLocalName(docTaxTotal, "TaxAmount") : null,
    ),
  );
  const payable = money(
    textOf(legal ? findFirstByLocalName(legal, "PayableAmount") : null),
  );

  if (lineExt != null && taxAmount != null && payable != null) {
    const expected = Math.round((lineExt + taxAmount) * 100) / 100;
    if (Math.abs(expected - payable) > 0.01) {
      issues.push(
        issue(
          P0_SUNAT_CODES.totales,
          `PayableAmount ${payable} != LineExtensionAmount+TaxAmount ${expected}`,
          "cac:LegalMonetaryTotal|RequestedMonetaryTotal/cbc:PayableAmount",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        P0_SUNAT_CODES.totales,
        "Missing LineExtensionAmount, TaxAmount, or PayableAmount for totals check",
        "cac:LegalMonetaryTotal|RequestedMonetaryTotal",
      ),
    );
  }
}

/** Dispatch Excel P0/P1/P2 by document type. */
export async function runExcelRulesForType(
  documentType: "01" | "03" | "07" | "08",
  xml: string,
  ctx: ExcelRuleContext = {},
): Promise<SunatValidationIssue[]> {
  if (documentType === "01") {
    return runP0InvoiceRules(xml, ctx);
  }
  if (documentType === "03") {
    return runP1BoletaRules(xml, ctx);
  }
  return runP2NoteRules(xml, documentType, ctx);
}
