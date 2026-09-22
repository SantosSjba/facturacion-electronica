import { fetchDocument } from "./api";
import { TERMINAL_STATUSES, type DocumentPublic } from "./types";

export async function pollDocumentStatus(
  id: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<DocumentPublic> {
  const intervalMs = options.intervalMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const started = Date.now();
  let last = await fetchDocument(id);

  while (!TERMINAL_STATUSES.has(last.status)) {
    if (Date.now() - started >= timeoutMs) {
      return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await fetchDocument(id);
  }
  return last;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
