import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import type { CatalogPort } from "@factosys/sunat-catalogs";
import { JsonCatalogAdapter } from "@factosys/sunat-catalogs";

import type { SunatValidationIssue } from "../ports/sunat-validation.port";
import { isObsMigratedToError } from "./obs-to-error";

/**
 * Official-ish codes used by P0 typed rules (aligned to CódigosRetorno themes).
 * Not a full Excel row interpreter — gate v1 critical subset (doc 29 §7).
 */
export const P0_SUNAT_CODES = {
  ruc: "2070",
  serieNumero: "2324",
  moneda: "3206",
  taxScheme: "3101",
  totales: "2325",
} as const;

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
  // Ensure OBS→ERROR list is loaded (all P0 violations are severity error).
  void isObsMigratedToError(sunatCode);
  return {
    severity: "error",
    stage: "excel",
    sunatCode,
    message,
    path,
  };
}

/** Direct child `cbc:ID` of Invoice root (not nested Party IDs). */
function invoiceDocumentId(doc: Document): string {
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

export interface P0RuleContext {
  catalogs?: CatalogPort;
}

/**
 * Excel P0 critical checks for Invoice 01:
 * RUC, serie-número, moneda, TaxScheme, totales.
 */
export async function runP0InvoiceRules(
  xml: string,
  ctx: P0RuleContext = {},
): Promise<SunatValidationIssue[]> {
  const catalogs = ctx.catalogs ?? new JsonCatalogAdapter();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const issues: SunatValidationIssue[] = [];

  const supplierParty = findFirstByLocalName(doc, "AccountingSupplierParty");
  const supplierId = supplierParty
    ? findFirstByLocalName(supplierParty, "ID")
    : null;
  const ruc = textOf(supplierId);
  if (!/^\d{11}$/.test(ruc)) {
    issues.push(
      issue(
        P0_SUNAT_CODES.ruc,
        `Supplier RUC must be 11 digits (got '${ruc || "(empty)"}')`,
        "cac:AccountingSupplierParty//cbc:ID",
      ),
    );
  }

  const invoiceId = invoiceDocumentId(doc);
  if (!/^F[A-Z0-9]{3}-\d{8}$/i.test(invoiceId)) {
    issues.push(
      issue(
        P0_SUNAT_CODES.serieNumero,
        `Invoice ID must match F###-######## (got '${invoiceId || "(empty)"}')`,
        "cbc:ID",
      ),
    );
  }

  const currency = textOf(findFirstByLocalName(doc, "DocumentCurrencyCode"));
  if (!currency || !(await catalogs.hasCode("02", currency))) {
    issues.push(
      issue(
        P0_SUNAT_CODES.moneda,
        `DocumentCurrencyCode '${currency || "(empty)"}' is not in catalog 02`,
        "cbc:DocumentCurrencyCode",
      ),
    );
  }

  const taxSchemeEl = findFirstByLocalName(doc, "TaxScheme");
  const taxSchemeId = textOf(
    taxSchemeEl ? findFirstByLocalName(taxSchemeEl, "ID") : null,
  );
  // Gravada uses scheme 1000; require 1000 or catalog 05 entry
  if (taxSchemeId && taxSchemeId !== "1000") {
    const inCatalog = await catalogs.hasCode("05", taxSchemeId);
    if (!inCatalog) {
      issues.push(
        issue(
          P0_SUNAT_CODES.taxScheme,
          `TaxScheme ID '${taxSchemeId}' is not recognized for Invoice P0`,
          "cac:TaxTotal//cac:TaxScheme/cbc:ID",
        ),
      );
    }
  } else if (!taxSchemeId) {
    issues.push(
      issue(
        P0_SUNAT_CODES.taxScheme,
        "Missing TaxScheme ID under document TaxTotal",
        "cac:TaxTotal//cac:TaxScheme/cbc:ID",
      ),
    );
  }

  const legal = findFirstByLocalName(doc, "LegalMonetaryTotal");
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
          "cac:LegalMonetaryTotal/cbc:PayableAmount",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        P0_SUNAT_CODES.totales,
        "Missing LineExtensionAmount, TaxAmount, or PayableAmount for totals check",
        "cac:LegalMonetaryTotal",
      ),
    );
  }

  return issues;
}
