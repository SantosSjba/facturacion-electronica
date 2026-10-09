import { describe, expect, it } from "vitest";
import { AppError } from "@factosys/shared";
import {
  hydrateFromFixtureRequest,
  XmlInvoiceBuilder,
  type InvoiceFixtureRequest,
} from "@factosys/sunat-ubl";
import { encodeCpeTxt } from "../../../../../../packages/sdk/src/helpers/cpe-txt";
import { phase1Scenarios } from "../../../../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import { invoiceCreateSchema, type InvoiceCreate } from "../dto/invoice-create.schema";
import { receiptCreateSchema } from "../dto/receipt-create.schema";
import { creditNoteCreateSchema } from "../dto/credit-note-create.schema";
import { debitNoteCreateSchema } from "../dto/debit-note-create.schema";
import { hashRequestBody } from "../../../infrastructure/idempotency/request-hash";
import { validateCpeInput } from "../../../infrastructure/documents/cpe-input";
import { CpeInputPipe, withCpeSource } from "./cpe-input.pipe";

const fixture = () => {
  const scenario = phase1Scenarios()[0];
  if (!scenario) throw new Error("Missing fixture");
  const body = { ...scenario };
  delete body.document_type;
  delete body.number;
  return { ...body, company_id: "00000000-0000-4000-8000-000000000001" };
};
function firstLine(body: InvoiceFixtureRequest) {
  const line = body.lines[0];
  if (!line) throw new Error("Missing line");
  return line;
}
const pipe = new CpeInputPipe(invoiceCreateSchema, "01");
function details(text: string) {
  try {
    pipe.transform(text);
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return (error as AppError).details;
  }
}

describe("Factosys TXT v1", () => {
  it("produces identical normalized bodies, idempotency hashes, totals and XML for commercial scenarios", () => {
    for (const scenario of phase1Scenarios()) {
      const input = { ...scenario };
      delete input.document_type;
      delete input.number;
      const body = { ...input, company_id: fixture().company_id };
      const json = pipe.transform(body) as InvoiceCreate;
      const txt = pipe.transform(encodeCpeTxt("01", body)) as InvoiceCreate;
      expect(txt).toEqual(json);
      expect(hashRequestBody(txt)).toBe(hashRequestBody(json));
      const build = (value: InvoiceCreate) =>
        new XmlInvoiceBuilder().build(hydrateFromFixtureRequest(value as InvoiceFixtureRequest));
      expect(build(txt)).toEqual(build(json));
    }
  });
  it("preserves pipes, Unicode, escaped newlines and backslashes with CRLF and BOM", () => {
    const body = fixture();
    firstLine(body).description = 'Ñ | "A"\nC:\\items';
    const text = "\uFEFF" + encodeCpeTxt("01", body).replaceAll("\n", "\r\n");
    expect(pipe.transform(text)).toEqual(pipe.transform(body));
  });
  it("supports boletas and both note types using their original schemas", () => {
    const common = fixture();
    expect(
      new CpeInputPipe(receiptCreateSchema, "03").transform(
        encodeCpeTxt("03", { ...common, serie: "B001" }),
      ),
    ).toEqual(receiptCreateSchema.parse({ ...common, serie: "B001" }));
    const { operation_type, ...note } = common;
    expect(operation_type).toBe("0101");
    const body = {
      ...note,
      note_type: "01",
      reason: "Ajuste",
      affected_document: { document_type: "01", serie_number: "F001-1" },
    };
    for (const [type, schema] of [
      ["07", creditNoteCreateSchema],
      ["08", debitNoteCreateSchema],
    ] as const) {
      expect(new CpeInputPipe(schema, type).transform(encodeCpeTxt(type, body))).toEqual(
        schema.parse(body),
      );
    }
  });
  it("locates structural and schema errors by physical row and field", () => {
    expect(details('FACTOSYS|1|01\nFIELD|currency|"PEN"\nFIELD|currency|"USD"')[0]?.path).toBe(
      "rows.3.currency",
    );
    expect(details("FACTOSYS|1|01\nFIELD|__proto__|{}")[0]?.path).toBe("rows.2.field");
    expect(details("FACTOSYS|2|01")[0]?.path).toBe("rows.1.header");
    expect(details("FACTOSYS|1|03")[0]?.path).toBe("rows.1.header");
    expect(details("FACTOSYS|1|01\nFIELD|currency|1,25")[0]?.path).toBe("rows.2.currency");
    const body = fixture();
    firstLine(body).quantity = -1;
    const text = encodeCpeTxt("01", body);
    const row = text.split("\n").findIndex((record) => record.startsWith("LINE|")) + 1;
    expect(details(text)).toContainEqual(
      expect.objectContaining({ path: `rows.${row}.lines.0.quantity` }),
    );
    expect(details(encodeCpeTxt("01", { ...fixture(), ignored_field: true }))).toContainEqual(
      expect.objectContaining({ path: expect.stringMatching(/^rows\.\d+\.ignored_field$/) }),
    );
  });
  it("bounds bytes, records and lines and rejects empty records", () => {
    expect(details("FACTOSYS|1|01\n\n")[0]?.path).toBe("rows.2.record");
    expect(details("FACTOSYS|1|01\n" + "x".repeat(204800))[0]?.issue).toContain("200 KiB");
    expect(details("FACTOSYS|1|01\n" + "LINE|{}\n".repeat(1001))[0]?.path).toBe("rows.1002.lines");
    expect(details("FACTOSYS|1|01\n" + "LINE|{}\n".repeat(2000))[0]?.issue).toContain(
      "2000 records",
    );
  });
  it("maps fiscal failures without changing normalized payload or JSON errors", () => {
    const txt = pipe.transform(encodeCpeTxt("01", { ...fixture(), number: 5 })) as InvoiceCreate;
    try {
      validateCpeInput(txt);
      throw new Error("expected fiscal rejection");
    } catch (error) {
      const mapped = withCpeSource(error, txt) as AppError;
      expect(mapped.details?.[0]?.path).toMatch(/^rows\.\d+\.number$/);
      expect(withCpeSource(error, fixture())).toBe(error);
    }
  });
});
