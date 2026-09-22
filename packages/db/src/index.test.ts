import { describe, expect, it } from "vitest";

import { createDb, newId, organizations } from "./index";

describe("@factosys/db", () => {
  it("exports schema tables and uuidv7 ids", () => {
    expect(organizations).toBeDefined();
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("createDb returns a typed drizzle client", () => {
    const db = createDb(
      process.env["DATABASE_URL"] ??
        "postgresql://factosys:factosys@127.0.0.1:5433/factosys",
    );
    expect(db.query).toBeDefined();
    expect(typeof db.select).toBe("function");
  });
});
