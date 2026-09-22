import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import {
  createBillServiceFromEnv,
  parseCdrZip,
  type BillServicePort,
} from "@factosys/sunat-soap";
import type { DocumentStatus } from "@factosys/domain";

import type { Env } from "../config/env.schema";
import type { QueueJobData } from "../queues/queue.tokens";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "../documents/credentials-resolver";
import { DocumentsService } from "../documents/documents.service";

@Injectable()
export class SunatSendProcessor {
  private readonly logger = new Logger(SunatSendProcessor.name);
  private readonly bill: BillServicePort;

  constructor(
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    config: ConfigService<Env, true>,
  ) {
    process.env["SUNAT_BILL_MODE"] = config.get("SUNAT_BILL_MODE", {
      infer: true,
    });
    this.bill = createBillServiceFromEnv();
  }

  async process(job: Job<QueueJobData>): Promise<{ ok: true; status: string }> {
    const { organizationId, companyId, documentId } = job.data;
    if (!documentId) {
      throw new Error("sunat-send job missing documentId");
    }

    const doc = await this.documents.getById(organizationId, documentId);
    if (doc.status !== "queued") {
      this.logger.warn(
        `Skip sunat-send for ${documentId} status=${doc.status}`,
      );
      return { ok: true, status: doc.status };
    }

    const zipArtifact = await this.documents.getArtifact(
      organizationId,
      documentId,
      "zip",
    );
    const sol = await this.credentials.resolveSol(companyId);
    const ruc = sol.username.replace(/[A-Za-z].*$/, "") || "00000000000";
    const zipName =
      doc.serie && doc.number != null
        ? `${ruc}-${doc.documentType}-${doc.serie}-${doc.number}.zip`
        : `${documentId}.zip`;

    await this.documents.transitionStatus(documentId, "queued", "sent", {
      sentAt: new Date(),
    });
    await this.documents.appendEvent({
      organizationId,
      companyId,
      documentId,
      status: "sent",
      fromStatus: "queued",
      detail: "SendBill submitted",
      source: "worker",
    });

    try {
      const result = await this.bill.sendBill({
        zipBytes: zipArtifact.body,
        fileName: zipName,
        solUser: sol.username,
        solPassword: sol.password,
      });

      const cdr = parseCdrZip(result.rawCdrZip);
      const cdrKey = buildDocumentObjectKey({
        organizationId,
        companyId,
        documentId,
        kind: "cdr_xml",
        sha256: createHash("sha256").update(result.rawCdrZip).digest("hex"),
        ext: "zip",
      });
      await this.documents.putArtifact({
        organizationId,
        companyId,
        documentId,
        kind: "cdr_xml",
        body: result.rawCdrZip,
        contentType: "application/zip",
        objectKey: cdrKey,
      });

      const nextStatus = cdr.status as DocumentStatus;
      await this.documents.transitionStatus(documentId, "sent", nextStatus, {
        sunatResponseCode: cdr.sunatCode,
        sunatResponseMessage: cdr.sunatMessage ?? null,
        completedAt: new Date(),
      });
      await this.documents.appendEvent({
        organizationId,
        companyId,
        documentId,
        status: nextStatus,
        fromStatus: "sent",
        detail: cdr.sunatMessage ?? `CDR ${cdr.sunatCode}`,
        source: "sunat",
        data: { sunat_code: cdr.sunatCode },
      });

      return { ok: true, status: nextStatus };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "SendBill failed";
      this.logger.error(`sunat-send failed for ${documentId}: ${message}`);
      await this.documents.transitionStatus(documentId, "sent", "failed", {
        error: { message },
      });
      await this.documents.appendEvent({
        organizationId,
        companyId,
        documentId,
        status: "failed",
        fromStatus: "sent",
        detail: message,
        source: "worker",
      });
      throw cause;
    }
  }
}
