import { describe, expect, it } from "vitest";

import { filterUsers } from "./filters";
import type { OrgUser } from "./types";

const sample: OrgUser[] = [
  {
    id: "1",
    email: "owner@demo.local",
    name: "Owner",
    status: "active",
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    roles: ["owner"],
  },
  {
    id: "2",
    email: "viewer@demo.local",
    name: "Viewer",
    status: "disabled",
    lastLoginAt: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    roles: ["viewer"],
  },
];

describe("filterUsers", () => {
  it("filters by email substring", () => {
    expect(
      filterUsers(sample, { email: "viewer", role: "", status: "" }).map(
        (u) => u.id,
      ),
    ).toEqual(["2"]);
  });

  it("filters by role and status", () => {
    expect(
      filterUsers(sample, { email: "", role: "owner", status: "active" }).map(
        (u) => u.id,
      ),
    ).toEqual(["1"]);
    expect(
      filterUsers(sample, { email: "", role: "viewer", status: "active" }),
    ).toHaveLength(0);
  });
});
