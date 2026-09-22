import { type PipeTransform, Injectable } from "@nestjs/common";
import type { ZodType } from "zod";
import { AppError } from "@factosys/shared";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw AppError.validation(
        "Request validation failed",
        parsed.error.issues.map((i) => ({
          path: i.path.join(".") || undefined,
          issue: i.message,
        })),
      );
    }
    return parsed.data;
  }
}
