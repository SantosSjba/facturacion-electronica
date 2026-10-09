import { isRetryable, mapError, type FactosysErrorBody } from "./errors";
import type {
  CompanyLogoResponse,
  FactosysClientOptions,
  RequestOptions,
  InvoiceInput,
  ReceiptInput,
  NoteInput,
  CpeDocument,
  PreviewInput,
  PreviewValidation,
  CpeQr,
  DespatchInput,
  GreDocument,
} from "./types";

export class FactosysClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private idempotencyKey?: string;

  constructor(options: FactosysClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /** Returns a shallow clone that always sends Idempotency-Key. */
  withIdempotencyKey(key: string): FactosysClient {
    const clone = Object.create(Object.getPrototypeOf(this)) as FactosysClient;
    Object.assign(clone, this);
    clone.idempotencyKey = key;
    return clone;
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = path.startsWith("http")
      ? path
      : `${this.baseUrl.replace(/\/v1$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

    let attempt = 0;
    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...opts.headers,
        };
        const idem = opts.idempotencyKey ?? this.idempotencyKey;
        if (idem) headers["Idempotency-Key"] = idem;
        let body: string | FormData | undefined;
        if (opts.body !== undefined) {
          if (typeof FormData !== "undefined" && opts.body instanceof FormData) {
            body = opts.body;
          } else {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(opts.body);
          }
        }

        const res = await fetch(url, {
          method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
          headers,
          body,
          signal: controller.signal,
        });

        if (res.ok) {
          if (res.status === 204) return undefined as T;
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            return (await res.json()) as T;
          }
          return (await res.arrayBuffer()) as T;
        }

        let errBody: FactosysErrorBody;
        try {
          errBody = (await res.json()) as FactosysErrorBody;
        } catch {
          errBody = {
            code: "FACTOSYS_HTTP",
            message: res.statusText || `HTTP ${res.status}`,
            retryable: res.status >= 500,
          };
        }
        const err = mapError(res.status, errBody);
        if (isRetryable(err) && attempt <= this.maxRetries) {
          await sleep(Math.min(1000 * attempt, 5000));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  meta = {
    getRuleset: async () => {
      const origin = this.baseUrl.replace(/\/v1\/?$/, "");
      const res = await fetch(`${origin}/meta/ruleset`);
      if (!res.ok) {
        throw new Error(`getRuleset failed: HTTP ${res.status}`);
      }
      return (await res.json()) as {
        ruleset_version: string;
        source: string;
        source_sha256: string;
      };
    },
  };

  companies = {
    getLogo: (companyId: string) =>
      this.request<CompanyLogoResponse>(`/v1/companies/${encodeURIComponent(companyId)}/logo`),
    putLogo: (companyId: string, file: Blob, filename = "logo.png") => {
      const body = new FormData();
      body.append("file", file, filename);
      return this.request<CompanyLogoResponse>(
        `/v1/companies/${encodeURIComponent(companyId)}/logo`,
        { method: "PUT", body },
      );
    },
    deleteLogo: (companyId: string) =>
      this.request<undefined>(`/v1/companies/${encodeURIComponent(companyId)}/logo`, {
        method: "DELETE",
      }),
  };

  invoices = {
    create: (body: InvoiceInput, idempotencyKey: string) =>
      this.request<CpeDocument>("/v1/invoices", {
        method: "POST",
        body,
        idempotencyKey,
      }),
  };

  receipts = {
    create: (body: ReceiptInput, idempotencyKey: string) =>
      this.request<CpeDocument>("/v1/receipts", {
        method: "POST",
        body,
        idempotencyKey,
      }),
  };

  creditNotes = {
    create: (body: NoteInput, idempotencyKey: string) =>
      this.request<CpeDocument>("/v1/credit-notes", { method: "POST", body, idempotencyKey }),
  };
  debitNotes = {
    create: (body: NoteInput, idempotencyKey: string) =>
      this.request<CpeDocument>("/v1/debit-notes", { method: "POST", body, idempotencyKey }),
  };
  despatchAdvices = {
    create: (body: DespatchInput, idempotencyKey: string) =>
      this.request<GreDocument>("/v1/despatch-advices", { method: "POST", body, idempotencyKey }),
    reconcileTicket: (id: string, ticket: string) =>
      this.request<GreDocument>(`/v1/despatch-advices/${encodeURIComponent(id)}/reconcile-ticket`, {
        method: "POST",
        body: { ticket },
      }),
  };
  previews = {
    validate: (body: PreviewInput) =>
      this.request<PreviewValidation>("/v1/previews/validate", { method: "POST", body }),
    getXml: (body: PreviewInput) =>
      this.request<ArrayBuffer>("/v1/previews/xml", { method: "POST", body }),
    getPdf: (body: PreviewInput) =>
      this.request<ArrayBuffer>("/v1/previews/pdf", { method: "POST", body }),
  };
  documents = {
    getQr: (id: string) => this.request<CpeQr>(`/v1/documents/${encodeURIComponent(id)}/qr`),
    getQrImage: (id: string) =>
      this.request<ArrayBuffer>(`/v1/documents/${encodeURIComponent(id)}/qr.png`),
    get: (id: string) => this.request(`/v1/documents/${id}`),
    getXml: (id: string) => this.request<ArrayBuffer>(`/v1/documents/${id}/xml`),
    getPdf: (id: string) => this.request<ArrayBuffer>(`/v1/documents/${id}/pdf`),
    getCdr: (id: string) => this.request<ArrayBuffer>(`/v1/documents/${id}/cdr`),
    getTrace: (id: string) => this.request(`/v1/documents/${id}/trace`),
  };

  webhooks = {
    list: () => this.request("/v1/webhook-endpoints"),
    create: (body: unknown) => this.request("/v1/webhook-endpoints", { method: "POST", body }),
    rotateSecret: (id: string) =>
      this.request(`/v1/webhook-endpoints/${id}/rotate-secret`, {
        method: "POST",
      }),
  };

  validations = {
    validateCpe: (body: unknown) => this.request("/v1/validations/cpe", { method: "POST", body }),
  };

  /**
   * Create invoice and poll until terminal status or timeout.
   */
  async createInvoiceAndWait(
    body: InvoiceInput,
    opts: { idempotencyKey: string; timeoutMs?: number; pollMs?: number },
  ): Promise<Record<string, unknown>> {
    const created = (await this.invoices.create(body, opts.idempotencyKey)) as {
      id: string;
      status: string;
    };
    const timeout = opts.timeoutMs ?? 60_000;
    const pollMs = opts.pollMs ?? 250;
    const deadline = Date.now() + timeout;
    let doc = created;
    const terminal = new Set([
      "accepted",
      "accepted_with_observation",
      "rejected",
      "failed",
      "cancelled",
    ]);
    while (!terminal.has(doc.status) && Date.now() < deadline) {
      await sleep(pollMs);
      doc = (await this.documents.get(created.id)) as typeof doc;
    }
    return doc as unknown as Record<string, unknown>;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
