import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { AppError } from "@factosys/shared";
import type { Request, Response } from "express";

export interface ApiErrorBody {
  code: string;
  message: string;
  sunat_code?: string | null;
  sunat_message?: string | null;
  stage?: string;
  retryable?: boolean;
  details?: { path?: string; issue: string }[];
  request_id?: string;
  ruleset_version?: string;
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId =
      (typeof request.headers["x-request-id"] === "string"
        ? request.headers["x-request-id"]
        : undefined) ?? request.id;

    const { status, body } = this.mapException(exception, requestId);

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfter =
        exception instanceof AppError &&
        typeof exception.retryAfterSec === "number" &&
        exception.retryAfterSec > 0
          ? Math.ceil(exception.retryAfterSec)
          : 60;
      response.setHeader("Retry-After", String(retryAfter));
    }

    if (status >= 500) {
      this.logger.error({ err: exception, request_id: requestId }, body.message);
    }

    response.status(status).json(body);
  }

  private mapException(
    exception: unknown,
    requestId: string | undefined,
  ): { status: number; body: ApiErrorBody } {
    if (exception instanceof Error && "type" in exception) {
      const parserType = exception.type;
      if (parserType === "entity.too.large" || parserType === "entity.parse.failed") {
        return {
          status: parserType === "entity.too.large" ? 413 : 400,
          body: {
            code: "FACTOSYS_VALIDATION",
            message:
              parserType === "entity.too.large" ? "Request body too large" : "Invalid JSON body",
            stage: "request",
            retryable: false,
            request_id: requestId,
          },
        };
      }
    }
    if (exception instanceof AppError) {
      return {
        status: exception.httpStatus,
        body: {
          code: exception.code,
          message: exception.message,
          sunat_code: exception.sunatCode ?? null,
          sunat_message: exception.sunatMessage ?? null,
          stage: exception.stage,
          retryable: exception.retryable,
          details: exception.details,
          request_id: requestId,
          ruleset_version: exception.rulesetVersion,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : typeof payload === "object" && payload !== null && "message" in payload
            ? Array.isArray((payload as { message: unknown }).message)
              ? (payload as { message: string[] }).message.join(", ")
              : String((payload as { message: unknown }).message)
            : exception.message;

      return {
        status,
        body: {
          code: status >= 500 ? "FACTOSYS_INTERNAL" : "FACTOSYS_HTTP",
          message,
          retryable: status >= 500,
          request_id: requestId,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: "FACTOSYS_INTERNAL",
        message: "Unexpected server error",
        retryable: true,
        request_id: requestId,
      },
    };
  }
}
