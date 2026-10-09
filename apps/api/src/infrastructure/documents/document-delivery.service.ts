import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { documentDeliveries, documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import type { Job } from "bullmq";
import { DB } from "../persistence/db.tokens";
import { DocumentsService } from "./documents.service";
import { PdfService } from "../pdf/pdf.service";
import { EmailService, EmailDeliveryError } from "../notifications/email.service";
import { QueueProducer } from "../queues/queue.producer";
import type { QueueJobData } from "../queues/queue.tokens";

@Injectable()
export class DocumentDeliveryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly docs: DocumentsService,
    private readonly pdf: PdfService,
    private readonly email: EmailService,
    private readonly queues: QueueProducer,
  ) {}
  async request(org: string, docId: string, key: string, recipients: string[]) {
    const normalized = [...new Set(recipients.map((r) => r.trim().toLowerCase()))].sort();
    const hash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, docId), eq(documents.organizationId, org)))
        .for("update");
      if (!doc) throw AppError.notFound("Document not found");
      if (!["01", "03", "07", "08", "09", "31", "20", "40"].includes(doc.documentType))
        throw AppError.validation("Only CPE and GRE can be delivered", [], { httpStatus: 422 });
      if (this.blocked(doc))
        throw AppError.conflict("Rejected or cancelled document cannot be delivered");
      const existing = await tx
        .select()
        .from(documentDeliveries)
        .where(
          and(
            eq(documentDeliveries.organizationId, org),
            eq(documentDeliveries.documentId, docId),
            eq(documentDeliveries.requestKey, key),
          ),
        );
      if (existing.length) {
        if (existing.some((d) => d.requestHash !== hash))
          throw AppError.conflict("Delivery Idempotency-Key reused with different recipients");
        return;
      }
      await tx.insert(documentDeliveries).values(
        normalized.map((recipient) => ({
          id: newId(),
          organizationId: org,
          documentId: docId,
          recipient,
          requestKey: key,
          requestHash: hash,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })),
      );
    });
    await this.dispatchDocument(org, docId);
    return this.list(org, docId);
  }
  async list(org: string, id: string) {
    await this.docs.getById(org, id);
    return this.db
      .select({
        id: documentDeliveries.id,
        recipient: documentDeliveries.recipient,
        status: documentDeliveries.status,
        attempts: documentDeliveries.attempts,
        provider_message_id: documentDeliveries.providerMessageId,
        error: documentDeliveries.error,
        created_at: documentDeliveries.createdAt,
        updated_at: documentDeliveries.updatedAt,
      })
      .from(documentDeliveries)
      .where(
        and(eq(documentDeliveries.organizationId, org), eq(documentDeliveries.documentId, id)),
      );
  }
  async retry(org: string, id: string, deliveryId: string, reason: string) {
    await this.docs.getById(org, id);
    const [delivery] = await this.db
      .update(documentDeliveries)
      .set({
        status: "waiting",
        error: null,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentDeliveries.id, deliveryId),
          eq(documentDeliveries.organizationId, org),
          eq(documentDeliveries.documentId, id),
          inArray(documentDeliveries.status, ["failed", "unknown", "expired"]),
        ),
      )
      .returning();
    if (!delivery)
      throw AppError.conflict("Only failed, unknown or expired delivery may be retried");
    await this.docs.appendEvent({
      organizationId: org,
      companyId: (await this.docs.getById(org, id)).companyId,
      documentId: id,
      status: (await this.docs.getById(org, id)).status,
      source: "api",
      detail: "Recipient delivery retry explicitly requested",
      data: { delivery_id: deliveryId, reason },
    });
    await this.dispatchDocument(org, id);
    return this.list(org, id);
  }
  /** Durable outbox sweep; no PII or file content in Redis jobs. */
  async sweep() {
    await this.db
      .update(documentDeliveries)
      .set({
        status: "unknown",
        error: "Worker stopped during provider submission; review before manual retry",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentDeliveries.status, "sending"),
          lt(documentDeliveries.updatedAt, new Date(Date.now() - 300000)),
        ),
      );
    await this.db
      .update(documentDeliveries)
      .set({ status: "waiting", updatedAt: new Date() })
      .where(
        and(
          eq(documentDeliveries.status, "preparing"),
          lt(documentDeliveries.updatedAt, new Date(Date.now() - 300000)),
        ),
      );
    const pending = await this.db
      .select()
      .from(documentDeliveries)
      .where(inArray(documentDeliveries.status, ["waiting", "queued"]))
      .orderBy(asc(documentDeliveries.updatedAt))
      .limit(200);
    const seen = new Set<string>();
    for (const d of pending)
      if (!seen.has(d.documentId)) {
        seen.add(d.documentId);
        await this.dispatchDocument(d.organizationId, d.documentId);
      }
  }
  async dispatchDocument(org: string, id: string) {
    const doc = await this.docs.getById(org, id);
    const deliveries = await this.db
      .select()
      .from(documentDeliveries)
      .where(
        and(
          eq(documentDeliveries.organizationId, org),
          eq(documentDeliveries.documentId, id),
          inArray(documentDeliveries.status, ["waiting", "queued"]),
        ),
      );
    for (const d of deliveries) {
      if (d.expiresAt.getTime() < Date.now() || this.blocked(doc)) {
        await this.update(d.id, {
          status: d.expiresAt.getTime() < Date.now() ? "expired" : "failed",
          error: "Delivery not eligible",
        });
        continue;
      }
      if (!this.accepted(doc)) {
        await this.update(d.id, {});
        continue;
      }
      if (d.status === "waiting")
        await this.db
          .update(documentDeliveries)
          .set({ status: "queued", updatedAt: new Date() })
          .where(and(eq(documentDeliveries.id, d.id), eq(documentDeliveries.status, "waiting")));
      try {
        await this.queues.enqueue(
          "document-delivery",
          { organizationId: org, companyId: doc.companyId, documentId: id, deliveryId: d.id },
          {
            attempts: 5,
            backoff: { type: "exponential", delay: 10000 },
            jobId: `document-mail-${d.id}-${d.attempts}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      } catch {
        /* Persisted queued row is retried by outbox sweep. */
      }
    }
  }
  async process(job: Job<QueueJobData>) {
    const { organizationId: org, documentId: id, deliveryId } = job.data;
    if (!id || !deliveryId) throw new Error("Missing document delivery IDs");
    const claimed = await this.db
      .update(documentDeliveries)
      .set({ status: "preparing", updatedAt: new Date() })
      .where(
        and(
          eq(documentDeliveries.id, deliveryId),
          eq(documentDeliveries.organizationId, org),
          eq(documentDeliveries.documentId, id),
          inArray(documentDeliveries.status, ["queued", "retrying"]),
        ),
      )
      .returning();
    const d = claimed[0];
    if (!d) return;
    const doc = await this.docs.getById(org, id);
    if (this.blocked(doc) || d.expiresAt.getTime() < Date.now()) {
      await this.finishPreparation(d, { status: "failed", error: "Delivery not eligible" });
      return;
    }
    if (!this.accepted(doc)) {
      await this.finishPreparation(d, { status: "waiting" });
      return;
    }
    let submitting = false;
    try {
      const pdf = await this.pdf.getOrRender(org, id);
      const xml = await this.docs.getArtifact(org, id, "xml_signed");
      const attachments = [
        { filename: `${doc.serieNumber}.pdf`, content: pdf.body, contentType: "application/pdf" },
        { filename: `${doc.serieNumber}.xml`, content: xml.body, contentType: "application/xml" },
      ];
      try {
        const cdr = await this.docs.getArtifact(org, id, "cdr_xml");
        attachments.push({
          filename: `${doc.serieNumber}-cdr.zip`,
          content: cdr.body,
          contentType: "application/zip",
        });
      } catch (e) {
        if (!(e instanceof AppError) || e.httpStatus !== 404) throw e;
      }
      // Recheck immediately before external submission; fiscal status can change during render.
      const current = await this.docs.getById(org, id);
      if (this.blocked(current) || !this.accepted(current)) {
        await this.finishPreparation(d, {
          status: "failed",
          error: "Fiscal state changed before delivery",
        });
        return;
      }
      const submitted = await this.finishPreparation(d, {
        status: "sending",
        attempts: d.attempts + 1,
      });
      if (!submitted.length) return; // A stale preparing worker cannot submit after its lease was recovered.
      submitting = true;
      const result = await this.email.send({
        to: d.recipient,
        subject: `Comprobante ${doc.serieNumber}`,
        text: `Adjuntamos el documento ${doc.serieNumber}. Estado fiscal: ${doc.status}; resumen: ${this.docs.toPublic(doc).summary_status ?? "no aplica"}.`,
        attachments,
        idempotencyKey: `document-${d.id}`,
        messageId: `<${d.id}@factosys.local>`,
      });
      await this.update(d.id, {
        status: "sent",
        providerMessageId: result.providerMessageId,
        error: null,
      });
    } catch (cause) {
      if (submitting && !(cause instanceof EmailDeliveryError && cause.retrySafe)) {
        await this.update(d.id, {
          status: "unknown",
          error: "Provider result uncertain; review before manual retry",
        });
        return;
      }
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 5);
      const fields = {
        status: last ? "failed" : "retrying",
        error: submitting
          ? "Provider rejected request; safe retry"
          : "Artifact preparation failed; no email submitted",
      };
      if (submitting) await this.update(d.id, fields);
      else await this.finishPreparation(d, fields);
      if (!last) throw new Error("Document delivery preparation failed", { cause });
    }
  }
  private accepted(d: typeof documents.$inferSelect) {
    return (
      ["accepted", "accepted_with_observation"].includes(d.status) ||
      this.docs.toPublic(d).summary_status === "accepted"
    );
  }
  private blocked(d: typeof documents.$inferSelect) {
    const p = d.payload as { cancellation_status?: string };
    return (
      ["rejected", "cancelled"].includes(d.status) ||
      this.docs.toPublic(d).summary_status === "rejected" ||
      p.cancellation_status === "cancelled"
    );
  }
  private update(id: string, fields: Partial<typeof documentDeliveries.$inferInsert>) {
    return this.db
      .update(documentDeliveries)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(documentDeliveries.id, id));
  }
  private finishPreparation(
    d: typeof documentDeliveries.$inferSelect,
    fields: Partial<typeof documentDeliveries.$inferInsert>,
  ) {
    return this.db
      .update(documentDeliveries)
      .set({ ...fields, updatedAt: new Date() })
      .where(
        and(
          eq(documentDeliveries.id, d.id),
          eq(documentDeliveries.status, "preparing"),
          eq(documentDeliveries.updatedAt, d.updatedAt),
        ),
      )
      .returning({ id: documentDeliveries.id });
  }
}
