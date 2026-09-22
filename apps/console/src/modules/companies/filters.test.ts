import { describe, expect, it } from "vitest";

import { filterCompanies } from "./filters";
import type { Company } from "./types";

const sample: Company[] = [
  {
    id: "1",
    organization_id: "o",
    ruc: "20123456789",
    legal_name: "Demo SAC",
    trade_name: null,
    environment: "sandbox",
    address: null,
    catalog_pin: {},
    timezone: "America/Lima",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    certificate_status: "missing",
    sol_configured: false,
    gre_configured: false,
  },
  {
    id: "2",
    organization_id: "o",
    ruc: "20999888777",
    legal_name: "Prod SAC",
    trade_name: null,
    environment: "production",
    address: null,
    catalog_pin: {},
    timezone: "America/Lima",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    certificate_status: "active",
    sol_configured: true,
    gre_configured: true,
  },
];

describe("filterCompanies", () => {
  it("filters by ruc substring", () => {
    expect(
      filterCompanies(sample, {
        ruc: "999",
        environment: "",
        certificate_status: "",
      }).map((c) => c.id),
    ).toEqual(["2"]);
  });

  it("filters by environment and certificate_status", () => {
    expect(
      filterCompanies(sample, {
        ruc: "",
        environment: "sandbox",
        certificate_status: "missing",
      }).map((c) => c.id),
    ).toEqual(["1"]);
  });
});
