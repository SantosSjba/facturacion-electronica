import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull } from "drizzle-orm";
import { documentShares, documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { DB } from "../persistence/db.tokens";
import { DocumentsService } from "./documents.service";
import { PdfService } from "../pdf/pdf.service";

@Injectable()
export class DocumentAccessService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly docs: DocumentsService,
    private readonly pdf: PdfService,
  ) {}
  async create(org: string, id: string, allowed: string[], ttl: number) {
    const token = randomBytes(32).toString("base64url"),
      shareId = newId(),
      expiresAt = new Date(Date.now() + ttl * 1000);
    await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.organizationId, org)))
        .for("update");
      if (!doc) throw AppError.notFound("Document not found");
      const active = await tx
        .select({ id: documentShares.id })
        .from(documentShares)
        .where(
          and(
            eq(documentShares.documentId, id),
            isNull(documentShares.revokedAt),
            gt(documentShares.expiresAt, new Date()),
          ),
        )
        .limit(20);
      if (active.length >= 20)
        throw AppError.conflict("Revoke an active share before creating another");
      await tx.insert(documentShares).values({
        id: shareId,
        organizationId: org,
        documentId: id,
        tokenHash: this.hash(token),
        allowedArtifacts: allowed,
        expiresAt,
      });
    });
    return {
      id: shareId,
      document_id: id,
      expires_at: expiresAt,
      allowed_artifacts: allowed,
      url: `/v1/shared-documents/${token}`,
    };
  }
  async list(org: string, doc: string) {
    await this.docs.getById(org, doc);
    return this.db
      .select({
        id: documentShares.id,
        document_id: documentShares.documentId,
        allowed_artifacts: documentShares.allowedArtifacts,
        expires_at: documentShares.expiresAt,
        revoked_at: documentShares.revokedAt,
      })
      .from(documentShares)
      .where(and(eq(documentShares.organizationId, org), eq(documentShares.documentId, doc)));
  }
  async revoke(org: string, doc: string, id: string) {
    const rows = await this.db
      .update(documentShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(documentShares.organizationId, org),
          eq(documentShares.documentId, doc),
          eq(documentShares.id, id),
        ),
      )
      .returning({ id: documentShares.id });
    if (!rows.length) throw AppError.notFound("Share not found");
  }
  async read(token: string, kind?: "pdf" | "xml" | "cdr" | "qr") {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw AppError.notFound("Shared document not found");
    const [share] = await this.db
      .select()
      .from(documentShares)
      .where(
        and(
          eq(documentShares.tokenHash, this.hash(token)),
          isNull(documentShares.revokedAt),
          gt(documentShares.expiresAt, new Date()),
        ),
      );
    if (!share) throw AppError.notFound("Shared document not found");
    const doc = await this.docs.getById(share.organizationId, share.documentId);
    if (kind && !share.allowedArtifacts.includes(kind))
      throw AppError.notFound("Shared artifact not found");
    const fiscal = this.docs.toPublic(doc);
    if (
      kind &&
      !["accepted", "accepted_with_observation"].includes(doc.status) &&
      fiscal.summary_status !== "accepted"
    )
      throw AppError.conflict("Recipient artifacts require fiscal acceptance");
    if (
      kind &&
      (doc.status === "cancelled" ||
        doc.status === "rejected" ||
        fiscal.summary_status === "rejected" ||
        (doc.payload as { cancellation_status?: string }).cancellation_status === "cancelled")
    )
      throw AppError.conflict("Recipient document is cancelled or rejected");
    if (kind === "pdf") return this.pdf.getOrRender(share.organizationId, share.documentId);
    if (kind === "qr") {
      const qr = await this.pdf.getQr(share.organizationId, share.documentId);
      return {
        body: Buffer.from(qr.data_url.split(",")[1] ?? "", "base64"),
        contentType: "image/png",
      };
    }
    if (kind)
      return this.docs.getArtifact(
        share.organizationId,
        share.documentId,
        kind === "xml" ? "xml_signed" : "cdr_xml",
      );
    return {
      document_type: doc.documentType,
      serie_number: doc.serieNumber,
      issue_date: doc.issueDate,
      status: doc.status,
      summary_status: this.docs.toPublic(doc).summary_status,
      allowed_artifacts: share.allowedArtifacts,
      expires_at: share.expiresAt,
    };
  }
  private hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
