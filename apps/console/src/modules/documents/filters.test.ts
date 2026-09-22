import { describe, expect, it } from "vitest";

import {
  EMPTY_DOCUMENT_FILTERS,
  filtersToParams,
} from "./filters";
import { TERMINAL_STATUSES } from "./types";

describe("documents filters", () => {
  it("omits empty filter fields", () => {
    expect(filtersToParams(EMPTY_DOCUMENT_FILTERS)).toEqual({ limit: 50 });
  });

  it("maps filled filters", () => {
    expect(
      filtersToParams({
        ...EMPTY_DOCUMENT_FILTERS,
        company_id: "11111111-1111-1111-1111-111111111111",
        document_type: "01",
        status: "accepted",
      }),
    ).toMatchObject({
      company_id: "11111111-1111-1111-1111-111111111111",
      document_type: "01",
      status: "accepted",
      limit: 50,
    });
  });
});

describe("terminal statuses", () => {
  it("includes accepted variants and failures", () => {
    expect(TERMINAL_STATUSES.has("accepted")).toBe(true);
    expect(TERMINAL_STATUSES.has("accepted_with_observation")).toBe(true);
    expect(TERMINAL_STATUSES.has("rejected")).toBe(true);
    expect(TERMINAL_STATUSES.has("queued")).toBe(false);
  });
});
