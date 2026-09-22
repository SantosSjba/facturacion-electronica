export type FactosysClientOptions = {
  apiKey: string;
  /** Base URL including /v1 or origin only — paths are absolute from host root. */
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export type RequestOptions = {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};
