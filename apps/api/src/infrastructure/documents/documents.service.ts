import { createHash } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";
import { and, asc, desc, eq, gte, ilike, inArray, lte, lt, or } from "drizzle-orm";
import { documentArtifacts, documentEvents, documents, newId, type Db } from "@factosys/db";
import type { DocumentStatus } from "@factosys/domain";
import { AppError } from "@factosys/shared";

import { ObjectStorageService } from "../storage/object-storage.service";
import { DB } from "../persistence/db.tokens";
import { WebhookFanoutService } from "../webhooks/webhook-fanout.service";
import { assertStatusTransition } from "./document-status";

export interface DocumentPublic {
  id: string;
  company_id: string;
  document_type: string;
  serie_number: string | null;
  status: string;
  environment: string;
  issue_date: string | null;
  customer: {
    identity_type: string | null;
    identity_number: string | null;
    name: string | null;
  };
  currency: string | null;
  totals: Record<string, unknown> | null;
  sunat_ticket: string | null;
  sunat_code: string | null;
  sunat_message: string | null;
  summary_status: string | null;
  error: DocumentPublicError | null;
  gre?: {
    qr_status: string;
    pdf_status: string;
    cdr_status: string;
    reconciliation_required: boolean;
    reason?: string;
    simulated: boolean;
  };
  printing?: { format: string; template_version: string };
  links: {
    self: string;
    xml: string;
    cdr: string;
    pdf: string;
    trace: string;
    qr?: string;
  };
  created_at: Date;
  updated_at: Date;
}

export interface DocumentPublicError {
  code?: string;
  message?: string;
  sunat_code?: string;
  details?: unknown[];
}

export interface DocumentListFilters {
  environment?: "sandbox" | "production";
  companyId?: string;
  /** Single type or multiple (e.g. GRE list 09+31). */
  documentType?: string;
  documentTypes?: string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  serieNumber?: string;
  limit?: number;
  cursor?: string;
}

export interface DocumentListResult {
  items: DocumentPublic[];
  next_cursor: string | null;
}

@Injectable()
export class DocumentsService {
  async findByIdentifiers(
    org: string,
    companyId: string,
    type: string,
    serie: string,
    number: number,
  ) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, org),
          eq(documents.companyId, companyId),
          eq(documents.documentType, type),
          eq(documents.serie, serie.toUpperCase()),
          eq(documents.number, number),
        ),
      )
      .limit(1);
    if (!doc) throw AppError.notFound("Document not found");
    return this.getDetails(org, doc.id);
  }
  async findByTicket(org: string, companyId: string, ticket: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, org),
          eq(documents.companyId, companyId),
          eq(documents.sunatTicket, ticket),
        ),
      )
      .limit(1);
    if (!doc) throw AppError.notFound("Document not found");
    return this.getDetails(org, doc.id);
  }
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: ObjectStorageService,
    @Optional() private readonly webhookFanout?: WebhookFanoutService,
  ) {}

  toPublic(row: typeof documents.$inferSelect): DocumentPublic {
    const id = row.id;
    return {
      id,
      company_id: row.companyId,
      document_type: row.documentType,
      serie_number: row.serieNumber,
      status: row.status,
      environment: row.environment,
      issue_date: row.issueDate ?? null,
      customer: {
        identity_type: row.customerIdentityType ?? null,
        identity_number: row.customerIdentityNumber ?? null,
        name: row.customerName ?? null,
      },
      currency: row.currency ?? null,
      totals: (row.totals as Record<string, unknown> | null) ?? null,
      sunat_ticket: row.sunatTicket,
      sunat_code: row.sunatResponseCode,
      sunat_message: row.sunatResponseMessage ?? null,
      summary_status: resolveSummaryStatus(row),
      error: redactDocumentError(row.error),
      printing: (row.payload as { _print?: { format: string; template_version: string } } | null)
        ?._print,
      ...(["09", "31"].includes(row.documentType) ? { gre: greAvailability(row) } : {}),
      links: {
        self: `/v1/documents/${id}`,
        xml: `/v1/documents/${id}/xml`,
        cdr: `/v1/documents/${id}/cdr`,
        pdf: `/v1/documents/${id}/pdf`,
        trace: `/v1/documents/${id}/trace`,
        ...(["01", "03", "07", "08", "09", "31", "20", "40"].includes(row.documentType)
          ? { qr: `/v1/documents/${id}/qr` }
          : {}),
      },
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  async list(
    organizationId: string,
    filters: DocumentListFilters = {},
  ): Promise<DocumentListResult> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const conditions = [eq(documents.organizationId, organizationId)];
    if (filters.environment) conditions.push(eq(documents.environment, filters.environment));

    if (filters.companyId) {
      conditions.push(eq(documents.companyId, filters.companyId));
    }
    if (filters.documentTypes && filters.documentTypes.length > 0) {
      conditions.push(inArray(documents.documentType, filters.documentTypes));
    } else if (filters.documentType) {
      conditions.push(eq(documents.documentType, filters.documentType));
    }
    if (filters.status) {
      conditions.push(eq(documents.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(documents.issueDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(documents.issueDate, filters.dateTo));
    }
    if (filters.serieNumber?.trim()) {
      const value = filters.serieNumber.trim().toUpperCase();
      const parts = /^([A-Z0-9]{4})-(\d{1,8})$/.exec(value);
      if (parts?.[1] && parts[2])
        conditions.push(eq(documents.serie, parts[1]), eq(documents.number, Number(parts[2])));
      else conditions.push(ilike(documents.serieNumber, `%${value}%`));
    }

    if (filters.cursor) {
      const cursorRows = await this.db
        .select({
          id: documents.id,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(and(eq(documents.id, filters.cursor), eq(documents.organizationId, organizationId)))
        .limit(1);
      const cursorRow = cursorRows[0];
      if (cursorRow) {
        const cursorFilter = or(
          lt(documents.createdAt, cursorRow.createdAt),
          and(eq(documents.createdAt, cursorRow.createdAt), lt(documents.id, cursorRow.id)),
        );
        if (cursorFilter) conditions.push(cursorFilter);
      }
    }

    const rows = await this.db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const next = rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((r) => this.toPublic(r)),
      next_cursor: next,
    };
  }

  async requireAcceptedAffected(input: {
    organizationId: string;
    companyId: string;
    documentType: string;
    serieNumber: string;
  }): Promise<typeof documents.$inferSelect> {
    const serieNumber = input.serieNumber.trim().toUpperCase();
    const rows = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, input.organizationId),
          eq(documents.companyId, input.companyId),
          eq(documents.documentType, input.documentType),
          eq(documents.serieNumber, serieNumber),
        ),
      )
      .limit(1);
    let row = rows[0];
    if (!row) {
      const m = serieNumber.match(/^([A-Z0-9]+)-0*(\d+)$/);
      if (m?.[1] && m[2]) {
        const byParts = await this.db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.organizationId, input.organizationId),
              eq(documents.companyId, input.companyId),
              eq(documents.documentType, input.documentType),
              eq(documents.serie, m[1]),
              eq(documents.number, Number(m[2])),
            ),
          )
          .limit(1);
        row = byParts[0];
      }
    }
    if (!row) {
      throw AppError.notFound(`Affected document ${input.documentType} ${serieNumber} not found`);
    }
    if (row.status !== "accepted" && row.status !== "accepted_with_observation") {
      throw AppError.validation(
        "Affected document must be accepted before issuing NC/ND",
        [
          {
            path: "affected_document",
            issue: `status is ${row.status}, expected accepted`,
          },
        ],
        { httpStatus: 422 },
      );
    }
    return row;
  }

  async getById(
    organizationId: string,
    documentId: string,
  ): Promise<typeof documents.$inferSelect> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Document not found");
    }
    return row;
  }

  async getDetails(organizationId: string, documentId: string) {
    const row = await this.getById(organizationId, documentId);
    const artifacts = await this.db
      .select({
        kind: documentArtifacts.kind,
        sha256: documentArtifacts.sha256,
        content_type: documentArtifacts.contentType,
      })
      .from(documentArtifacts)
      .where(
        and(
          eq(documentArtifacts.organizationId, organizationId),
          eq(documentArtifacts.documentId, documentId),
        ),
      );
    const payload = row.payload as {
      _sunat?: { observations?: string[] };
      _reconciliation?: unknown;
      summary_document_id?: string;
      cancellation_status?: string;
      cancellation_document_id?: string;
    };
    const events = await this.listEvents(organizationId, documentId);
    const voided = [...events]
      .reverse()
      .find((e) => (e.data as { voided_document_id?: string })?.voided_document_id);
    const stored = (kind: string) => artifacts.find((a) => a.kind === kind);
    let digest: string | undefined;
    if (stored("xml_signed") && ["01", "03", "07", "08", "20", "40"].includes(row.documentType)) {
      const xml = (await this.getArtifact(organizationId, documentId, "xml_signed")).body.toString(
        "utf8",
      );
      digest = xml.match(/<(?:\w+:)?DigestValue[^>]*>([^<]+)<\/(?:\w+:)?DigestValue>/)?.[1]?.trim();
    }
    const gre = ["09", "31"].includes(row.documentType) ? greAvailability(row) : undefined;
    return {
      ...this.toPublic(row),
      artifacts: Object.fromEntries(
        ["xml_signed", "zip", "cdr_xml", "pdf"].map((kind) => [
          kind,
          {
            status: stored(kind)
              ? "available"
              : kind === "pdf" &&
                  (!gre || gre.pdf_status === "available") &&
                  !!(row.payload as { _canonical?: unknown })._canonical
                ? "on_demand"
                : "pending",
            sha256: stored(kind)?.sha256 ?? null,
            content_type: stored(kind)?.content_type ?? null,
          },
        ]),
      ),
      observations: payload._sunat?.observations ?? [],
      qr: {
        status: ["RA", "RC", "RR"].includes(row.documentType)
          ? "not_applicable"
          : (gre?.qr_status ?? (digest ? "available" : "pending")),
        source: gre ? "sunat_cdr" : "signed_xml",
        digest: digest ?? null,
      },
      relations: {
        affected_document_id: row.relatedDocumentId,
        summary_document_id: payload.summary_document_id ?? null,
        reversion_document_id:
          (row.payload as { _reversion?: { document_id?: string; pending_id?: string } })
            ?._reversion?.document_id ??
          (row.payload as { _reversion?: { pending_id?: string } })?._reversion?.pending_id ??
          null,
        affected_document_ids:
          (row.payload as { affected_document_ids?: string[] })?.affected_document_ids ?? [],
        cancellation_document_id:
          payload.cancellation_document_id ??
          (voided?.data as { voided_document_id?: string } | undefined)?.voided_document_id ??
          null,
      },
      cancellation_status:
        row.status === "cancelled" ? "cancelled" : (payload.cancellation_status ?? "not_cancelled"),
      reversion: (row.payload as { _reversion?: unknown })?._reversion ?? null,
      tax_agent: ["20", "40", "RR"].includes(row.documentType)
        ? ((row.payload as { _agent?: unknown })?._agent ?? { simulated: null })
        : undefined,
      collection_status: "not_managed",
      reconciliation: payload._reconciliation ?? null,
    };
  }

  async listEvents(organizationId: string, documentId: string) {
    await this.getById(organizationId, documentId);
    return this.db
      .select()
      .from(documentEvents)
      .where(
        and(
          eq(documentEvents.documentId, documentId),
          eq(documentEvents.organizationId, organizationId),
        ),
      )
      .orderBy(asc(documentEvents.at));
  }

  async getArtifact(
    organizationId: string,
    documentId: string,
    kind: "xml_signed" | "cdr_xml" | "zip" | "pdf",
  ) {
    await this.getById(organizationId, documentId);
    const rows = await this.db
      .select()
      .from(documentArtifacts)
      .where(
        and(
          eq(documentArtifacts.documentId, documentId),
          eq(documentArtifacts.kind, kind),
          eq(documentArtifacts.organizationId, organizationId),
        ),
      )
      .limit(1);
    const art = rows[0];
    if (!art?.objectKey) {
      throw AppError.notFound(`Artifact ${kind} not found`);
    }
    const body = await this.storage.getObject(art.objectKey);
    return {
      body,
      contentType: art.contentType ?? "application/octet-stream",
      sha256: art.sha256,
    };
  }

  async appendEvent(
    input: {
      organizationId: string;
      companyId: string;
      documentId: string;
      status: string;
      fromStatus?: string | null;
      detail?: string;
      source: "api" | "worker" | "sunat" | "system";
      data?: Record<string, unknown>;
    },
    tx?: Parameters<Parameters<Db["transaction"]>[0]>[0],
  ): Promise<string> {
    const id = newId();
    await (tx ?? this.db).insert(documentEvents).values({
      id,
      organizationId: input.organizationId,
      companyId: input.companyId,
      documentId: input.documentId,
      status: input.status,
      fromStatus: input.fromStatus ?? null,
      detail: input.detail ?? null,
      source: input.source,
      data: input.data ?? {},
    });
    if (!tx) this.publishEvent(input, id);
    return id;
  }
  publishEvent(input: Parameters<DocumentsService["appendEvent"]>[0], id: string): void {
    if (this.webhookFanout) {
      const sunatCode =
        typeof input.data?.["sunat_code"] === "string" ? input.data["sunat_code"] : undefined;
      void this.webhookFanout
        .onStatusChanged({
          organizationId: input.organizationId,
          companyId: input.companyId,
          documentId: input.documentId,
          status: input.status,
          previousStatus: input.fromStatus,
          eventId: id,
          sunatCode,
          sunatMessage: input.detail,
        })
        .catch(() => undefined);
    }
  }

  async patchPayload(documentId: string, patch: Record<string, unknown>): Promise<void> {
    const rows = await this.db
      .select({ payload: documents.payload })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    const current = (rows[0]?.payload ?? {}) as Record<string, unknown>;
    await this.db
      .update(documents)
      .set({
        payload: { ...current, ...patch },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  }

  async listByIds(
    organizationId: string,
    companyId: string,
    ids: string[],
  ): Promise<(typeof documents.$inferSelect)[]> {
    if (!ids.length) return [];
    const rows = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.organizationId, organizationId), eq(documents.companyId, companyId)));
    const set = new Set(ids);
    return rows.filter((r) => set.has(r.id));
  }

  async listPendingSummaryPool(input: {
    organizationId: string;
    companyId: string;
    referenceDate: string;
  }): Promise<(typeof documents.$inferSelect)[]> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, input.organizationId),
          eq(documents.companyId, input.companyId),
          eq(documents.issueDate, input.referenceDate),
        ),
      );
    return rows.filter((row) => {
      if (!["03", "07", "08"].includes(row.documentType)) return false;
      if (row.status !== "accepted" && row.status !== "accepted_with_observation") {
        return false;
      }
      return resolveSummaryStatus(row) === "pending";
    });
  }

  async transitionStatus(
    documentId: string,
    from: DocumentStatus,
    to: DocumentStatus,
    patch: Partial<{
      sunatResponseCode: string | null;
      sunatResponseMessage: string | null;
      sunatTicket: string | null;
      error: Record<string, unknown> | null;
      sentAt: Date | null;
      completedAt: Date | null;
      queuedAt: Date | null;
    }> = {},
  ): Promise<void> {
    assertStatusTransition(from, to);
    await this.db
      .update(documents)
      .set({
        status: to,
        updatedAt: new Date(),
        ...patch,
      })
      .where(eq(documents.id, documentId));
  }

  async putArtifact(
    input: {
      organizationId: string;
      companyId: string;
      documentId: string;
      kind: "xml_signed" | "zip" | "cdr_xml" | "request_json" | "pdf";
      body: Buffer;
      contentType: string;
      objectKey: string;
    },
    executor: Pick<Db, "insert" | "select" | "update"> = this.db,
  ): Promise<Buffer | undefined> {
    if (input.kind === "pdf") {
      // Serialize the first render across API/worker processes; preserve historical bytes.
      return this.db.transaction(async (tx) => {
        const [doc] = await tx
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.id, input.documentId),
              eq(documents.organizationId, input.organizationId),
              eq(documents.companyId, input.companyId),
            ),
          )
          .for("update");
        if (!doc) throw AppError.notFound("Document not found");
        const [existing] = await tx
          .select()
          .from(documentArtifacts)
          .where(
            and(
              eq(documentArtifacts.documentId, input.documentId),
              eq(documentArtifacts.kind, "pdf"),
            ),
          );
        if (existing?.objectKey) {
          const stored = await this.storage.getObject(existing.objectKey);
          if (
            !stored.toString("latin1").includes("Factosys RI Fake PDF") ||
            input.body.toString("latin1").includes("Factosys RI Fake PDF")
          )
            return stored;
        }
        const sha256 = createHash("sha256").update(input.body).digest("hex");
        await this.storage.putObject(input.objectKey, input.body, input.contentType);
        await tx
          .insert(documentArtifacts)
          .values({
            id: newId(),
            organizationId: input.organizationId,
            companyId: input.companyId,
            documentId: input.documentId,
            kind: "pdf",
            storageBackend: "s3",
            bucket: this.storage.getBucket(),
            objectKey: input.objectKey,
            contentType: input.contentType,
            sha256,
            sizeBytes: input.body.length,
          })
          .onConflictDoUpdate({
            target: [documentArtifacts.documentId, documentArtifacts.kind],
            set: {
              objectKey: input.objectKey,
              sha256,
              sizeBytes: input.body.length,
              contentType: input.contentType,
              bucket: this.storage.getBucket(),
            },
          });
        return input.body;
      });
    }
    const sha256 = createHash("sha256").update(input.body).digest("hex");
    await this.storage.putObject(input.objectKey, input.body, input.contentType);

    const existing = await executor
      .select({ id: documentArtifacts.id })
      .from(documentArtifacts)
      .where(
        and(
          eq(documentArtifacts.documentId, input.documentId),
          eq(documentArtifacts.kind, input.kind),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await executor
        .update(documentArtifacts)
        .set({
          objectKey: input.objectKey,
          bucket: this.storage.getBucket(),
          contentType: input.contentType,
          sha256,
          sizeBytes: input.body.length,
        })
        .where(eq(documentArtifacts.id, existing[0].id));
      return undefined;
    }

    await executor.insert(documentArtifacts).values({
      id: newId(),
      organizationId: input.organizationId,
      companyId: input.companyId,
      documentId: input.documentId,
      kind: input.kind,
      storageBackend: "s3",
      bucket: this.storage.getBucket(),
      objectKey: input.objectKey,
      contentType: input.contentType,
      sha256,
      sizeBytes: input.body.length,
    });
    return undefined;
  }
}

function resolveSummaryStatus(row: typeof documents.$inferSelect): string | null {
  const payload = (row.payload ?? {}) as {
    include_in_daily_summary?: boolean;
    send_individually?: boolean;
    summary_status?: string;
  };
  if (typeof payload.summary_status === "string" && payload.summary_status) {
    return payload.summary_status;
  }
  if (row.documentType === "03") {
    if (payload.send_individually === true) return "not_required";
    if (payload.include_in_daily_summary === false) return "not_required";
    return "pending";
  }
  if (
    (row.documentType === "07" || row.documentType === "08") &&
    payload.include_in_daily_summary === true
  ) {
    return "pending";
  }
  return null;
}

function redactDocumentError(raw: unknown): DocumentPublicError | null {
  if (!raw || typeof raw !== "object") return null;
  const err = raw as Record<string, unknown>;
  const out: DocumentPublicError = {};
  if (typeof err["code"] === "string") out.code = err["code"];
  if (typeof err["message"] === "string") out.message = err["message"];
  if (typeof err["sunat_code"] === "string") out.sunat_code = err["sunat_code"];
  if (Array.isArray(err["details"])) out.details = err["details"];
  return Object.keys(out).length > 0 ? out : null;
}

function greAvailability(row: typeof documents.$inferSelect) {
  const payload = row.payload as {
    _canonical?: unknown;
    _gre?: {
      qr_url?: string;
      qr_source?: string;
      cdr_available?: boolean;
      reconciliation_required?: boolean;
      reason?: string;
      simulated?: boolean;
    };
  } | null;
  const accepted = ["accepted", "accepted_with_observation"].includes(row.status);
  const ready =
    accepted &&
    !!payload?._gre?.qr_url &&
    payload?._gre?.qr_source === "sunat_cdr" &&
    !payload?._gre?.simulated;
  const state = row.status === "rejected" ? "unavailable" : ready ? "available" : "pending";
  return {
    qr_status: state,
    cdr_status: payload?._gre?.cdr_available
      ? "available"
      : row.status === "rejected"
        ? "unavailable"
        : "pending",
    pdf_status: ready && !payload?._canonical ? "historical_snapshot_missing" : state,
    reconciliation_required: payload?._gre?.reconciliation_required ?? false,
    reason: payload?._gre?.reason,
    simulated: payload?._gre?.simulated ?? false,
  };
}
