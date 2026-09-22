import { describe, expect, it } from "vitest";

import { EMPTY_GRE_FILTERS, filtersToParams } from "./filters";

describe("gre filters", () => {
  it("defaults document_type to 09,31", () => {
    expect(EMPTY_GRE_FILTERS.document_type).toBe("09,31");
    expect(filtersToParams(EMPTY_GRE_FILTERS)).toEqual({
      document_type: "09,31",
      limit: 50,
    });
  });

  it("omits empty filter fields", () => {
    expect(
      filtersToParams({
        ...EMPTY_GRE_FILTERS,
        document_type: "",
      }),
    ).toEqual({ limit: 50 });
  });

  it("maps filled filters", () => {
    expect(
      filtersToParams({
        ...EMPTY_GRE_FILTERS,
        company_id: "11111111-1111-1111-1111-111111111111",
        document_type: "09",
        status: "accepted",
        serie_number: "T001-1",
      }),
    ).toMatchObject({
      company_id: "11111111-1111-1111-1111-111111111111",
      document_type: "09",
      status: "accepted",
      serie_number: "T001-1",
      limit: 50,
    });
  });
});
