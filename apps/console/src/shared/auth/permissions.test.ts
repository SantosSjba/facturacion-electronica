import { describe, expect, it } from "vitest";

import { filterNavByPermissions, hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("allows when no permission required", () => {
    expect(hasPermission([], undefined)).toBe(true);
  });

  it("checks membership", () => {
    expect(hasPermission(["companies:read"], "companies:read")).toBe(true);
    expect(hasPermission(["companies:read"], "apikeys:manage")).toBe(false);
  });
});

describe("filterNavByPermissions", () => {
  const items = [
    { id: "companies", permission: "companies:read" },
    { id: "users", permission: "users:read" },
    { id: "apikeys", permission: "apikeys:manage" },
  ];

  it("hides API keys and users for viewer-like perms", () => {
    const viewer = ["companies:read", "documents:read"];
    const visible = filterNavByPermissions(items, viewer).map((i) => i.id);
    expect(visible).toEqual(["companies"]);
    expect(visible).not.toContain("apikeys");
    expect(visible).not.toContain("users");
  });

  it("shows users and apikeys for owner-like perms", () => {
    const owner = ["companies:read", "users:read", "apikeys:manage"];
    const visible = filterNavByPermissions(items, owner).map((i) => i.id);
    expect(visible).toEqual(["companies", "users", "apikeys"]);
  });
});
