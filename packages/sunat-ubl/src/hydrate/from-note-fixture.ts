import {
  computeAutoTotals,
  toCanonical as toInvoiceCanonical,
} from "../totals/auto-totals";
import type { InvoiceCanonical } from "../types/invoice-canonical";
import {
  parseNoteFixtureRequest,
  type NoteCanonical,
  type NoteDocumentType,
  type NoteFixtureRequest,
} from "../types/note-canonical";
import { readAssetJson } from "../paths/package-root";
import { DEFAULT_CORRELATIVE, SPIKE_SUPPLIER } from "./from-fixture";

interface FixtureFile {
  id: string;
  request: unknown;
}

export function loadCreditNoteVoidFixtureRequest(): NoteFixtureRequest {
  const file = readAssetJson<FixtureFile>(
    "assets/fixtures/07-credit-note-void.json",
  );
  return parseNoteFixtureRequest(file.request);
}

export function loadDebitNoteInterestFixtureRequest(): NoteFixtureRequest {
  const file = readAssetJson<FixtureFile>(
    "assets/fixtures/08-debit-note-interest.json",
  );
  return parseNoteFixtureRequest(file.request);
}

/**
 * Hydrate note fixture → NoteCanonical (reuses invoice auto-totals).
 */
export function hydrateNoteFromFixtureRequest(
  request: NoteFixtureRequest,
  documentType: NoteDocumentType,
  options?: {
    supplier?: InvoiceCanonical["supplier"];
    number?: number;
  },
): NoteCanonical {
  const number = options?.number ?? request.number ?? DEFAULT_CORRELATIVE;
  const supplier = options?.supplier ?? { ...SPIKE_SUPPLIER };

  // Reuse invoice totals engine with a synthetic invoice-shaped request
  const invoiceShape = {
    company_id: request.company_id,
    serie: request.serie,
    operation_type: "0101",
    issue_date: request.issue_date,
    currency: request.currency,
    totals_mode: request.totals_mode,
    customer: request.customer,
    lines: request.lines,
  };
  const { lines, totals } = computeAutoTotals(invoiceShape);
  const invoiceCanon = toInvoiceCanonical({
    request: invoiceShape,
    supplier,
    number,
    lines,
    totals,
  });

  return {
    document_type: documentType,
    serie: invoiceCanon.serie,
    number: invoiceCanon.number,
    issue_date: request.issue_date,
    currency: request.currency,
    note_type: request.note_type,
    reason: request.reason,
    affected_document: {
      document_type: request.affected_document.document_type,
      serie_number: request.affected_document.serie_number.toUpperCase(),
    },
    totals_mode: request.totals_mode ?? "auto",
    supplier,
    customer: request.customer,
    lines: invoiceCanon.lines,
    totals: invoiceCanon.totals,
  };
}

export function hydrateCreditNoteVoidFixture(options?: {
  supplier?: InvoiceCanonical["supplier"];
  number?: number;
  affectedSerieNumber?: string;
}): NoteCanonical {
  const request = loadCreditNoteVoidFixtureRequest();
  if (options?.affectedSerieNumber) {
    request.affected_document.serie_number = options.affectedSerieNumber;
  } else if (
    request.affected_document.serie_number.includes("{{")
  ) {
    request.affected_document.serie_number = "F001-00000001";
  }
  return hydrateNoteFromFixtureRequest(request, "07", options);
}

export function hydrateDebitNoteInterestFixture(options?: {
  supplier?: InvoiceCanonical["supplier"];
  number?: number;
  affectedSerieNumber?: string;
}): NoteCanonical {
  const request = loadDebitNoteInterestFixtureRequest();
  if (options?.affectedSerieNumber) {
    request.affected_document.serie_number = options.affectedSerieNumber;
  } else if (
    request.affected_document.serie_number.includes("{{")
  ) {
    request.affected_document.serie_number = "F001-00000001";
  }
  return hydrateNoteFromFixtureRequest(request, "08", options);
}
