import type { INestApplication } from "@nestjs/common";
import { json, type Request, type Response, type NextFunction } from "express";

export function configureBodyParsers(app: INestApplication): void {
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
