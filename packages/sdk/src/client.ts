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
  CompanyInput,
  CompanyPatch,
  SeriesInput,
  DocumentShare,
  DocumentDelivery,
  DocumentDetails,
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
    // Resource methods close over their owning client; construct them on the new instance.
    const clone = new FactosysClient({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
    });
    clone.idempotencyKey = key;
    return clone;
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    if (opts.textBody !== undefined && opts.body !== undefined) {
      throw new Error("body and textBody are mutually exclusive");
    }
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
        if (opts.textBody !== undefined) {
          headers["Content-Type"] = "text/plain; charset=utf-8";
          body = opts.textBody;
        }
        if (opts.body !== undefined) {
          if (typeof FormData !== "undefined" && opts.body instanceof FormData) {
            body = opts.body;
          } else {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(opts.body);
          }
        }

        const res = await fetch(url, {
          method:
            opts.method ??
            (opts.body !== undefined || opts.textBody !== undefined ? "POST" : "GET"),
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
        const method = (
          opts.method ?? (opts.body !== undefined || opts.textBody !== undefined ? "POST" : "GET")
        ).toUpperCase();
        const safeRetry = ["GET", "PUT", "DELETE"].includes(method) || !!idem;
        if (safeRetry && isRetryable(err) && attempt <= this.maxRetries) {
          await sleep(Math.min(1000 * attempt, 5000));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  txt = {
    create: (documentType: "01" | "03" | "07" | "08", textBody: string, key?: string) => {
      const routes = {
        "01": "invoices",
        "03": "receipts",
        "07": "credit-notes",
        "08": "debit-notes",
      };
      return this.request<CpeDocument>(`/v1/${routes[documentType]}`, {
        method: "POST",
        textBody,
        idempotencyKey: key,
      });
    },
  };

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

  retentions = {
    create: (body: import("./types").TaxAgentCreate, key?: string) =>
      this.request<import("./types").TaxAgentDocument>("/v1/retentions", {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
  };
  perceptions = {
    create: (body: import("./types").TaxAgentCreate, key?: string) =>
      this.request<import("./types").TaxAgentDocument>("/v1/perceptions", {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
  };
  reversions = {
    create: (body: import("./types").ReversionInput, key?: string) =>
      this.request<import("./types").TaxAgentDocument>("/v1/reversions", {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    reconcileTicket: (id: string) =>
      this.request<import("./types").DocumentDetails>(
        `/v1/reversions/${encodeURIComponent(id)}/reconcile-ticket`,
        { method: "POST" },
      ),
  };
  companies = {
    remove: (id: string, permanent = false) =>
      this.request<undefined>(`/v1/companies/${encodeURIComponent(id)}?permanent=${permanent}`, {
        method: "DELETE",
      }),
    list: () => this.request("/v1/companies"),
    get: (id: string) => this.request(`/v1/companies/${encodeURIComponent(id)}`),
    create: (body: CompanyInput) => this.request("/v1/companies", { method: "POST", body }),
    update: (id: string, body: CompanyPatch) =>
      this.request(`/v1/companies/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    listSeries: (id: string) => this.request(`/v1/companies/${encodeURIComponent(id)}/series`),
    createSeries: (id: string, body: SeriesInput) =>
      this.request(`/v1/companies/${encodeURIComponent(id)}/series`, { method: "POST", body }),
    updateSeries: (
      id: string,
      seriesId: string,
      body: Pick<SeriesInput, "padding" | "is_active">,
    ) =>
      this.request(
        `/v1/companies/${encodeURIComponent(id)}/series/${encodeURIComponent(seriesId)}`,
        { method: "PATCH", body },
      ),
    putSolCredentials: (id: string, username: string, password: string) =>
      this.request<undefined>(`/v1/companies/${encodeURIComponent(id)}/sol-credentials`, {
        method: "PUT",
        body: { username, password },
      }),
    putGreCredentials: (id: string, clientId: string, clientSecret: string) =>
      this.request<undefined>(`/v1/companies/${encodeURIComponent(id)}/gre-credentials`, {
        method: "PUT",
        body: { client_id: clientId, client_secret: clientSecret },
      }),
    putCertificate: (id: string, file: Blob, password: string, filename = "certificate.pfx") => {
      const body = new FormData();
      body.append("file", file, filename);
      body.append("password", password);
      return this.request<undefined>(`/v1/companies/${encodeURIComponent(id)}/certificate`, {
        method: "PUT",
        body,
      });
    },
    revokeCredential: (id: string, kind: "certificate" | "sol" | "gre") =>
      this.request<undefined>(`/v1/companies/${encodeURIComponent(id)}/credentials/${kind}`, {
        method: "DELETE",
      }),
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
  companyTools = {
    convertCertificate: (cert: string, cert_pass: string, base64 = true) =>
      this.request<{ pem: string; cer: string }>("/v1/company-tools/certificate", {
        method: "POST",
        body: { cert, cert_pass, base64 },
      }),
    generateTestCertificate: (password: string) =>
      this.request<{ pfx: string; test_only: true; sunat_acceptance: string }>(
        "/v1/company-tools/certificate/free",
        { method: "POST", body: { password } },
      ),
    encodeFile: (file: Blob, filename = "file.bin") => {
      const body = new FormData();
      body.append("file", file, filename);
      return this.request<{ base64: string; size_bytes: number }>("/v1/company-tools/file/base64", {
        method: "POST",
        body,
      });
    },
    decodeFile: (base64: string, filename = "file.bin") =>
      this.request<ArrayBuffer>("/v1/company-tools/base64/file", {
        method: "POST",
        body: { base64, filename },
      }),
  };
  sale = {
    getQr: (body: import("./types").SaleQrInput) =>
      this.request<ArrayBuffer>("/v1/sale/qr", { method: "POST", body }),
  };
  documents = {
    getByTicket: (company_id: string, ticket: string) =>
      this.request<DocumentDetails>(
        "/v1/document-status/ticket?" + new URLSearchParams({ company_id, ticket }),
      ),
    recoverCdrByIdentifiers: (company_id: string, tipo: string, serie: string, numero: number) =>
      this.request<DocumentDetails>("/v1/document-status/recover-cdr", {
        method: "POST",
        body: { company_id, tipo, serie, numero },
      }),
    getByIdentifiers: (company_id: string, tipo: string, serie: string, numero: number) =>
      this.request<DocumentDetails>(
        "/v1/document-status?" +
          new URLSearchParams({ company_id, tipo, serie, numero: String(numero) }),
      ),
    list: (
      filters: {
        company_id?: string;
        document_type?: string;
        serie_number?: string;
        status?: string;
        date_from?: string;
        date_to?: string;
        cursor?: string;
        limit?: number;
      } = {},
    ) =>
      this.request<{ items: DocumentDetails[]; next_cursor: string | null }>(
        "/v1/documents?" +
          new URLSearchParams(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ),
      ),
    recoverCdr: (id: string) =>
      this.request<DocumentDetails>(`/v1/documents/${encodeURIComponent(id)}/recover-cdr`, {
        method: "POST",
      }),
    deliver: (id: string, recipients: string[], idempotencyKey: string) =>
      this.request<DocumentDelivery[]>(`/v1/documents/${encodeURIComponent(id)}/deliveries`, {
        method: "POST",
        body: { recipients },
        idempotencyKey,
      }),
    listDeliveries: (id: string) =>
      this.request<DocumentDelivery[]>(`/v1/documents/${encodeURIComponent(id)}/deliveries`),
    retryDelivery: (id: string, deliveryId: string, reason: string) =>
      this.request<DocumentDelivery[]>(
        `/v1/documents/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}/retry`,
        { method: "POST", body: { reason } },
      ),
    createShare: (
      id: string,
      allowedArtifacts: ("pdf" | "xml" | "cdr" | "qr")[] = ["pdf"],
      ttlSeconds = 86400,
    ) =>
      this.request<DocumentShare>(`/v1/documents/${encodeURIComponent(id)}/shares`, {
        method: "POST",
        body: { allowed_artifacts: allowedArtifacts, ttl_seconds: ttlSeconds },
      }),
    listShares: (id: string) => this.request(`/v1/documents/${encodeURIComponent(id)}/shares`),
    revokeShare: (id: string, shareId: string) =>
      this.request<undefined>(
        `/v1/documents/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`,
        { method: "DELETE" },
      ),
    getQr: (id: string) => this.request<CpeQr>(`/v1/documents/${encodeURIComponent(id)}/qr`),
    getQrImage: (id: string) =>
      this.request<ArrayBuffer>(`/v1/documents/${encodeURIComponent(id)}/qr.png`),
    get: (id: string) => this.request<DocumentDetails>(`/v1/documents/${encodeURIComponent(id)}`),
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
