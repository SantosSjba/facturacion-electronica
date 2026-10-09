import { describe, expect, it } from "vitest";
import { solUsernameForApi, solUsernameForInput } from "./sol-username";
import { ApiError } from "../../shared/api/errors";

describe("SOL panel credentials", () => {
  const ruc = "20601234567";
  it("adds the company's RUC to secondary usernames and trims only the username", () => {
    expect(solUsernameForApi(ruc, "  TESTUSER  ")).toBe(ruc + "TESTUSER");
    expect(solUsernameForApi(ruc, "12345678")).toBe(ruc + "12345678");
  });
  it("does not duplicate an existing RUC or rewrite another company's full username", () => {
    expect(solUsernameForApi(ruc, ruc + "TESTUSER")).toBe(ruc + "TESTUSER");
    expect(solUsernameForApi(ruc, "20123456789TESTUSER")).toBe("20123456789TESTUSER");
    expect(solUsernameForApi(ruc, ruc)).toBe(ruc);
    expect(solUsernameForApi(ruc, "  ")).toBe("");
  });
  it("opens saved usernames without their company prefix", () => {
    expect(solUsernameForInput(ruc, ruc + "TESTUSER")).toBe("TESTUSER");
    expect(solUsernameForInput(ruc, "TESTUSER")).toBe("TESTUSER");
    expect(solUsernameForInput(ruc, null)).toBe("");
  });
  it("explains the API username validation failure in Spanish", () => {
    const error = new ApiError(422, {
      code: "FACTOSYS_VALIDATION",
      message: "SOL username must include this company's RUC and user",
    });
    expect(error.message).toContain("RUC de esta empresa");
    expect(error.message).not.toContain("Revisa los datos ingresados");
  });
});
