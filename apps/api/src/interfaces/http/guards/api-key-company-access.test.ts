import { expect, it } from "vitest";
import type { Request } from "express";
import type { Db } from "@factosys/db";
import type { ApiKeyAuthContext } from "../auth/auth-context";
import { enforceApiKeyCompanies } from "./api-key-company-access";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const auth = (): ApiKeyAuthContext => ({
  kind: "api_key",
  organizationId: "org",
  apiKeyId: "key",
  scopes: [],
  companyIds: [a],
});
const db = {
  select: () => ({ from: () => ({ where: async () => [{ id: a, environment: "sandbox" }] }) }),
} as unknown as Db;
function req(path: string, input: Partial<Request> = {}) {
  return { originalUrl: path, params: {}, query: {}, method: "POST", ...input } as Request;
}
it("fails closed when companies or persistence are unavailable", async () => {
  await expect(enforceApiKeyCompanies(undefined, req("/v1/whoami"), auth())).rejects.toMatchObject({
    httpStatus: 403,
  });
  await expect(
    enforceApiKeyCompanies(db, req("/v1/whoami"), { ...auth(), companyIds: [] }),
  ).rejects.toMatchObject({ httpStatus: 403 });
});
it("requires a policy for new protected routes even if their body contains a company", async () => {
  await expect(
    enforceApiKeyCompanies(db, req("/v1/new-resource", { body: { company_id: a } }), auth()),
  ).rejects.toMatchObject({ httpStatus: 403 });
});
it("checks every explicit emitter instead of trusting one location over another", async () => {
  await expect(
    enforceApiKeyCompanies(
      db,
      req("/v1/invoices", { query: { company_id: b }, body: { company_id: a } }),
      auth(),
    ),
  ).rejects.toMatchObject({ httpStatus: 403 });
  await expect(
    enforceApiKeyCompanies(
      db,
      req(`/v1/companies/${b}`, { params: { id: b }, body: { company_id: a } }),
      auth(),
    ),
  ).rejects.toMatchObject({ httpStatus: 403 });
});
it("allows logo routes that identify their emitter as companyId", async () => {
  await expect(
    enforceApiKeyCompanies(
      db,
      req(`/v1/companies/${a}/logo`, { params: { companyId: a } }),
      auth(),
    ),
  ).resolves.toBeUndefined();
  await expect(
    enforceApiKeyCompanies(db, req(`/companies/${b}/logo`, { params: { companyId: b } }), auth()),
  ).rejects.toMatchObject({ httpStatus: 403 });
});
it.each([
  "FACTOSYS|1|01",
  `FIELD|company_id|"${a}"\nFIELD|company_id|"${a}"`,
  "FIELD|company_id|broken",
])("rejects missing, duplicate and invalid TXT emitters: %s", async (body) => {
  await expect(
    enforceApiKeyCompanies(db, req("/v1/invoices", { body }), auth()),
  ).rejects.toMatchObject({ httpStatus: 400 });
});
it("rechecks company environment on each request", async () => {
  await expect(
    enforceApiKeyCompanies(db, req("/v1/whoami"), {
      ...auth(),
      environmentConstraint: "production",
    }),
  ).rejects.toMatchObject({ httpStatus: 403 });
});
