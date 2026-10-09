import { describe, it, expect } from "vitest";
import {
  phase1Request,
  phase1Scenarios,
} from "../../../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import { invoiceCreateSchema } from "../../interfaces/http/dto/invoice-create.schema";
import { creditNoteCreateSchema } from "../../interfaces/http/dto/credit-note-create.schema";
import { validateCpeInput } from "./cpe-input";
describe("commercial prevalidation", () => {
  it.each(phase1Scenarios().map((body, index) => ({ body, index })))(
    "accepts scenario $index",
    ({ body }) =>
      expect(() =>
        validateCpeInput(
          invoiceCreateSchema.parse({
            ...body,
            company_id: "01900000-0000-7000-8000-000000000001",
          }),
        ),
      ).not.toThrow(),
  );
  it("rejects inconsistent commercial combinations before orchestration", () => {
    const r = { ...phase1Request(), company_id: "01900000-0000-7000-8000-000000000001" };
    for (const extra of [
      { operation_type: "1001" },
      {
        detraction: {
          goods_code: "037",
          percent: 12,
          amount: 14,
          account: "00000000001",
          payment_means_code: "001",
        },
      },
      {
        exchange_rate: {
          source_currency: "USD",
          target_currency: "PEN",
          rate: 3.7,
          date: r.issue_date,
          source: "Contrato",
        },
      },
      {
        payment_terms: {
          condition: "credit",
          currency: "PEN",
          outstanding_amount: 119,
          installments: [{ number: 1, due_date: "2026-11-08", amount: 119 }],
        },
      },
    ])
      expect(() => validateCpeInput(invoiceCreateSchema.parse({ ...r, ...extra }))).toThrow();
  });
  it("rejects invalid note reasons and debit quota/date misuse", () => {
    const r = {
      ...phase1Request(),
      company_id: "01900000-0000-7000-8000-000000000001",
      note_type: "99",
      reason: "Ajuste",
      affected_document: { document_type: "01", serie_number: "F001-1" },
    };
    expect(() => validateCpeInput(creditNoteCreateSchema.parse(r), "07")).toThrow();
    expect(() =>
      validateCpeInput(
        creditNoteCreateSchema.parse({ ...r, note_type: "13", due_date: "2026-11-08" }),
        "08",
      ),
    ).toThrow();
  });
});
