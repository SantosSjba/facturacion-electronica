import { type PipeTransform } from "@nestjs/common";
import { AppError } from "@factosys/shared";
import type { ZodType } from "zod";

export const TXT_MAX_BYTES = 200 * 1024;
export const TXT_MAX_LINES = 1000;
const txtSources = new WeakMap<object, Map<string, number>>();

/** Preserve TXT locations for fiscal validation failures without persisting transport metadata. */
export function withCpeSource(error: unknown, body: object): unknown {
  const rows = txtSources.get(body);
  if (!rows || !(error instanceof AppError) || error.code !== "FACTOSYS_VALIDATION") return error;
  return AppError.validation(
    error.message,
    error.details?.map((detail) => {
      const path = detail.path ?? "header";
      const parts = path.split(".");
      const source =
        parts[0] === "lines" && /^\d+$/.test(parts[1] ?? "")
          ? `lines.${parts[1]}`
          : (parts[0] ?? "header");
      return { ...detail, path: `rows.${rows.get(source) ?? 1}.${path}` };
    }),
    { httpStatus: error.httpStatus },
  );
}

/** A transport adapter only: every value still passes the existing JSON schema. */
export class CpeInputPipe implements PipeTransform {
  constructor(
    private readonly schema: ZodType,
    private readonly documentType: string,
  ) {}

  transform(input: unknown): unknown {
    const rows = new Map<string, number>();
    let value = input;
    const fail = (row: number, field: string, issue: string): never => {
      throw AppError.validation(
        "TXT validation failed",
        [{ path: `rows.${row}.${field}`, issue }],
        { httpStatus: 422 },
      );
    };
    if (typeof input === "string") {
      if (Buffer.byteLength(input, "utf8") > TXT_MAX_BYTES) fail(1, "body", "maximum 200 KiB");
      const records = input.replace(/^\uFEFF/, "").split(/\r?\n/);
      if (records.at(-1) === "") records.pop();
      if (records.length > 2000) fail(1, "body", "maximum 2000 records");
      if (records[0] !== `FACTOSYS|1|${this.documentType}`) {
        fail(1, "header", `expected FACTOSYS|1|${this.documentType}`);
      }
      const body: Record<string, unknown> = Object.create(null);
      const lines: unknown[] = [];
      for (let index = 1; index < records.length; index++) {
        const row = index + 1;
        const record = records[index] ?? "";
        let field = "";
        let raw = "";
        if (record.startsWith("LINE|")) {
          if (lines.length >= TXT_MAX_LINES) fail(row, "lines", "maximum 1000 lines");
          field = `lines.${lines.length}`;
          raw = record.slice(5);
        } else if (record.startsWith("FIELD|")) {
          const separator = record.indexOf("|", 6);
          if (separator < 0) fail(row, "record", "expected FIELD|field|JSON-value");
          field = record.slice(6, separator);
          if (
            !/^[a-z][a-z0-9_]*$/.test(field) ||
            ["lines", "__proto__", "prototype", "constructor"].includes(field)
          ) {
            fail(row, "field", "invalid or reserved field; use LINE for lines");
          }
          if (rows.has(field)) fail(row, field, "duplicate field");
          raw = record.slice(separator + 1);
        } else {
          fail(row, "record", "expected FIELD or LINE record; blank records are invalid");
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(raw);
        } catch {
          fail(row, field, "invalid JSON value; use decimal point and JSON escapes");
        }
        rows.set(field, row);
        if (field.startsWith("lines.")) lines.push(decoded);
        else body[field] = decoded;
      }
      body.lines = lines;
      value = body;
    }
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw AppError.validation(
        "Request validation failed",
        parsed.error.issues.map((issue) => {
          const path =
            issue.path.join(".") ||
            (typeof input === "string" && issue.code === "unrecognized_keys"
              ? (issue.keys[0] ?? "")
              : "");
          const source =
            issue.path[0] === "lines" && typeof issue.path[1] === "number"
              ? `lines.${issue.path[1]}`
              : String(issue.path[0] ?? path ?? "header");
          const row = rows.get(source) ?? 1;
          return {
            path: typeof input === "string" ? `rows.${row}.${path || "header"}` : path || undefined,
            issue: issue.message,
          };
        }),
        { httpStatus: 422 },
      );
    }
    if (typeof input === "string" && typeof parsed.data === "object" && parsed.data !== null) {
      txtSources.set(parsed.data, rows);
    }
    return parsed.data;
  }
}
