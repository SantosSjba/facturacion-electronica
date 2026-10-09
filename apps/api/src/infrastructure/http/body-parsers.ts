import type { INestApplication } from "@nestjs/common";
import { json, text, type Request, type Response, type NextFunction } from "express";

export function configureBodyParsers(app: INestApplication): void {
  const cpeText = text({
    type: "text/plain",
    limit: "200kb",
    defaultCharset: "utf-8",
    verify: (_req, _res, buffer, encoding) => {
      if (encoding !== "utf-8") throw new Error("TXT requires UTF-8");
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    },
  });
  app.use(
    ["/v1/invoices", "/v1/receipts", "/v1/credit-notes", "/v1/debit-notes"],
    function cpeTextBodyParser(req: Request, res: Response, next: NextFunction) {
      cpeText(req, res, next);
    },
  );
  const previewJson = json({ limit: "200kb" });
  // Nest detects existing parsers by handler name, regardless of their route.
  // A scoped handler named jsonParser would suppress JSON parsing for all other routes.
  app.use(
    "/v1/previews",
    function previewBodyParser(req: Request, res: Response, next: NextFunction) {
      previewJson(req, res, next);
    },
  );
}
