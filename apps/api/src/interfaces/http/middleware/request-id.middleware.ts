import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    (req as Request & { id: string }).id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
