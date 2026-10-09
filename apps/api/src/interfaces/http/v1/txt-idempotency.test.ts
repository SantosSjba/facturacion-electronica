import { expect, it, vi } from "vitest";
import { AppError } from "@factosys/shared";
import { loadGravadaFixtureRequest } from "@factosys/sunat-ubl";
import type { Response } from "express";
import { encodeCpeTxt } from "../../../../../../packages/sdk/src/helpers/cpe-txt";
import { hashRequestBody } from "../../../infrastructure/idempotency/request-hash";
import type { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { EmitInvoiceUseCase } from "../../../infrastructure/documents/emit-invoice.use-case";
import { CpeInputPipe } from "../pipes/cpe-input.pipe";
import { invoiceCreateSchema, type InvoiceCreate } from "../dto/invoice-create.schema";
import type { AuthContext } from "../auth/auth-context";
import { InvoicesController } from "./invoices.controller";

it("replays a JSON emission retried as TXT and rejects changed content or a missing key", async () => {
  let completed: { hash: string; responseBody: unknown } | undefined;
  const begin = vi.fn(async (input: { body: unknown }) => {
    const hash = hashRequestBody(input.body);
    if (completed) {
      if (completed.hash !== hash) throw AppError.idempotencyConflict();
      return { kind: "replay", responseCode: 201, responseBody: completed.responseBody };
    }
    return { kind: "proceed" };
  });
  const execute = vi.fn(async () => ({ id: "original-document" }));
  const idempotency = {
    begin,
    complete: vi.fn(async (input: { responseBody: unknown }) => {
      completed = {
        hash: hashRequestBody(begin.mock.calls.at(-1)?.[0].body),
        responseBody: input.responseBody,
      };
    }),
    release: vi.fn(),
  };
  const controller = new InvoicesController(
    { execute } as unknown as EmitInvoiceUseCase,
    idempotency as unknown as IdempotencyService,
  );
  const auth: AuthContext = {
    kind: "api_key",
    organizationId: "organization",
    apiKeyId: "key",
    companyIds: ["00000000-0000-4000-8000-000000000001"],
    scopes: ["documents:write"],
  };
  const res = { status: vi.fn() } as unknown as Response;
  const input = { ...loadGravadaFixtureRequest() };
  delete input.document_type;
  delete input.number;
  const body = { ...input, company_id: "00000000-0000-4000-8000-000000000001" };
  const pipe = new CpeInputPipe(invoiceCreateSchema, "01");
  const json = pipe.transform(body) as InvoiceCreate;
  const txt = pipe.transform(encodeCpeTxt("01", body)) as InvoiceCreate;
  const first = await controller.create(auth, "same-sale", json, res);
  expect(await controller.create(auth, "same-sale", txt, res)).toEqual(first);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(begin).toHaveBeenLastCalledWith(
    expect.objectContaining({
      organizationId: "organization",
      companyId: body.company_id,
      requestPath: "POST /v1/invoices",
      key: "same-sale",
      body: json,
    }),
  );
  await expect(
    controller.create(auth, "same-sale", { ...txt, purchase_order: "changed" }, res),
  ).rejects.toMatchObject({ httpStatus: 409 });
  await expect(controller.create(auth, undefined, txt, res)).rejects.toMatchObject({
    httpStatus: 422,
  });
  expect(execute).toHaveBeenCalledTimes(1);
});
