import {
  Body,
  Controller,
  Headers,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AppError } from "@factosys/shared";

import {
  EmitCreditNoteUseCase,
  EmitDebitNoteUseCase,
} from "../../../infrastructure/documents/emit-note.use-case";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import {
  creditNoteCreateSchema,
  type CreditNoteCreate,
} from "../dto/credit-note-create.schema";
import {
  debitNoteCreateSchema,
  type DebitNoteCreate,
} from "../dto/debit-note-create.schema";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@ApiTags("CreditNotes")
@ApiBearerAuth()
@Controller("v1")
export class CreditNotesController {
  constructor(
    private readonly emitCreditNote: EmitCreditNoteUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("credit-notes")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Emitir nota de crédito (07)" })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(creditNoteCreateSchema, 422))
    body: CreditNoteCreate,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    if (!key) {
      throw AppError.validation(
        "Idempotency-Key required",
        [{ path: "Idempotency-Key", issue: "missing" }],
        { httpStatus: 422 },
      );
    }

    const begin = await this.idempotency.begin({
      organizationId: auth.organizationId,
      companyId: body.company_id,
      key,
      requestPath: "POST /v1/credit-notes",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const doc = await this.emitCreditNote.execute({
        organizationId: auth.organizationId,
        body,
        idempotencyKey: key,
      });
      await this.idempotency.complete({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
        responseCode: 201,
        responseBody: doc,
        documentId: doc.id,
      });
      res.status(201);
      return doc;
    } catch (cause) {
      await this.idempotency.release({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
      });
      throw cause;
    }
  }
}

@ApiTags("DebitNotes")
@ApiBearerAuth()
@Controller("v1")
export class DebitNotesController {
  constructor(
    private readonly emitDebitNote: EmitDebitNoteUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("debit-notes")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Emitir nota de débito (08)" })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(debitNoteCreateSchema, 422))
    body: DebitNoteCreate,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    if (!key) {
      throw AppError.validation(
        "Idempotency-Key required",
        [{ path: "Idempotency-Key", issue: "missing" }],
        { httpStatus: 422 },
      );
    }

    const begin = await this.idempotency.begin({
      organizationId: auth.organizationId,
      companyId: body.company_id,
      key,
      requestPath: "POST /v1/debit-notes",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const doc = await this.emitDebitNote.execute({
        organizationId: auth.organizationId,
        body,
        idempotencyKey: key,
      });
      await this.idempotency.complete({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
        responseCode: 201,
        responseBody: doc,
        documentId: doc.id,
      });
      res.status(201);
      return doc;
    } catch (cause) {
      await this.idempotency.release({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
      });
      throw cause;
    }
  }
}
