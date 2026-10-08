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

export interface CompanyLogoResponse {
  logo: null | {
    content_type: string;
    size_bytes: number;
    width: number;
    height: number;
    sha256: string;
    updated_at: string;
  };
  data_url: string | null;
}
