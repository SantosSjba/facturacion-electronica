import { createHash } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import {
  documentArtifacts,
  documentEvents,
  documents,
  newId,
  type Db,
} from "@factosys/db";
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
  sunat_ticket: string | null;
  sunat_code: string | null;
  summary_status: string | null;
  links: {
    self: string;
    xml: string;
    cdr: string;
    pdf: string;
    trace: string;
  };
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class DocumentsService {
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
      sunat_ticket: row.sunatTicket,
      sunat_code: row.sunatResponseCode,
      summary_status: resolveSummaryStatus(row),
      links: {
        self: `/v1/documents/${id}`,
        xml: `/v1/documents/${id}/xml`,
        cdr: `/v1/documents/${id}/cdr`,
        pdf: `/v1/documents/${id}/pdf`,
        trace: `/v1/documents/${id}/trace`,
      },
      created_at: row.createdAt,
      updated_at: row.updatedAt,
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
      throw AppError.notFound(
        `Affected document ${input.documentType} ${serieNumber} not found`,
      );
    }
    if (
      row.status !== "accepted" &&
      row.status !== "accepted_with_observation"
    ) {
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
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Document not found");
    }
    return row;
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

  async appendEvent(input: {
    organizationId: string;
    companyId: string;
    documentId: string;
    status: string;
    fromStatus?: string | null;
    detail?: string;
    source: "api" | "worker" | "sunat" | "system";
    data?: Record<string, unknown>;
  }): Promise<string> {
    const id = newId();
    await this.db.insert(documentEvents).values({
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

    if (this.webhookFanout) {
      const sunatCode =
        typeof input.data?.["sunat_code"] === "string"
          ? input.data["sunat_code"]
          : undefined;
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

    return id;
  }

  async patchPayload(
    documentId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
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
      .where(
        and(
          eq(documents.organizationId, organizationId),
          eq(documents.companyId, companyId),
        ),
      );
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
      if (
        row.status !== "accepted" &&
        row.status !== "accepted_with_observation"
      ) {
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

  async putArtifact(input: {
    organizationId: string;
    companyId: string;
    documentId: string;
    kind: "xml_signed" | "zip" | "cdr_xml" | "request_json" | "pdf";
    body: Buffer;
    contentType: string;
    objectKey: string;
  }): Promise<void> {
    const sha256 = createHash("sha256").update(input.body).digest("hex");
    await this.storage.putObject(input.objectKey, input.body, input.contentType);

    const existing = await this.db
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
      await this.db
        .update(documentArtifacts)
        .set({
          objectKey: input.objectKey,
          bucket: this.storage.getBucket(),
          contentType: input.contentType,
          sha256,
          sizeBytes: input.body.length,
        })
        .where(eq(documentArtifacts.id, existing[0].id));
      return;
    }

    await this.db.insert(documentArtifacts).values({
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
  }
}

function resolveSummaryStatus(
  row: typeof documents.$inferSelect,
): string | null {
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
