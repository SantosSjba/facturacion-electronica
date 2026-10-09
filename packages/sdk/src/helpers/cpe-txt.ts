/** Encode the canonical API input; tax calculations remain on the server. */
export function encodeCpeTxt(
  documentType: "01" | "03" | "07" | "08",
  body: Record<string, unknown>,
): string {
  const records = [`FACTOSYS|1|${documentType}`];
  for (const [field, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (field === "lines") {
      if (!Array.isArray(value)) throw new Error("lines must be an array");
      for (const line of value) records.push(`LINE|${JSON.stringify(line)}`);
    } else {
      if (!/^[a-z][a-z0-9_]*$/.test(field) || ["constructor", "prototype"].includes(field)) {
        throw new Error("invalid TXT field");
      }
      records.push(`FIELD|${field}|${JSON.stringify(value)}`);
    }
  }
  return `${records.join("\n")}\n`;
}
