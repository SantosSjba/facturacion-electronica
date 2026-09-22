import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import {
  createBillServiceFromEnv,
  parseCdrZip,
  type BillServicePort,
} from "@factosys/sunat-soap";
import {
  createGreClientsFromEnv,
  type GreDespatchPort,
} from "@factosys/sunat-gre";
import type { DocumentStatus } from "@factosys/domain";

import type { Env } from "../config/env.schema";
import type { QueueJobData } from "../queues/queue.tokens";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "../documents/credentials-resolver";
import { DocumentsService } from "../documents/documents.service";
import { GreTokenCacheService } from "../gre/gre-token-cache.service";

/**
 * Polls ticket_pending docs:
 * - RA/RC → SOAP getStatus
 * - GRE 09/31 → REST consultarTicket
 */
@Injectable()
export class SunatPollProcessor {
  private readonly logger = new Logger(SunatPollProcessor.name);
  private readonly bill: BillServicePort;
  private readonly greDespatch: GreDespatchPort;

  constructor(
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly greTokens: GreTokenCacheService,
    config: ConfigService<Env, true>,
  ) {
    process.env["SUNAT_BILL_MODE"] = config.get("SUNAT_BILL_MODE", {
      infer: true,
    });
    process.env["SUNAT_GRE_MODE"] = config.get("SUNAT_GRE_MODE", {
      infer: true,
    });
    this.bill = createBillServiceFromEnv();
    this.greDespatch = createGreClientsFromEnv().despatch;
  }

  async process(job: Job<QueueJobData>): Promise<{ ok: true; status: string }> {
    const { organizationId, companyId, documentId } = job.data;
    if (!documentId) {
      throw new Error("sunat-poll job missing documentId");
    }

    const doc = await this.documents.getById(organizationId, documentId);
    if (doc.status !== "ticket_pending") {
      this.logger.warn(
        `Skip sunat-poll for ${documentId} status=${doc.status}`,
      );
      return { ok: true, status: doc.status };
    }
    if (!doc.sunatTicket) {
      throw new Error(`Document ${documentId} missing sunat_ticket`);
    }

    if (doc.documentType === "09" || doc.documentType === "31") {
      return this.processGre(organizationId, companyId, documentId, doc);
    }

    return this.processSoapSummary(organizationId, companyId, documentId, doc);
  }

  private async processGre(
    organizationId: string,
    companyId: string,
    documentId: string,
    doc: Awaited<ReturnType<DocumentsService["getById"]>>,
  ): Promise<{ ok: true; status: string }> {
    try {
      let accessToken = await this.greTokens.getAccessToken(companyId);
      let result;
      try {
        result = await this.greDespatch.getStatus({
          accessToken,
          ticket: doc.sunatTicket!,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/401|Unauthorized|OAuth/i.test(msg)) throw err;
        await this.greTokens.invalidate(companyId);
        accessToken = await this.greTokens.getAccessToken(companyId);
        result = await this.greDespatch.getStatus({
          accessToken,
          ticket: doc.sunatTicket!,
        });
      }

      if (result.status === "ticket_pending") {
        // Still processing — retry via BullMQ
        throw new Error(`GRE ticket ${doc.sunatTicket} still pending`);
      }

      if (result.rawCdrZip?.length) {
        const cdrKey = buildDocumentObjectKey({
          organizationId,
          companyId,
          documentId,
          kind: "cdr_xml",
          sha256: createHash("sha256")
            .update(result.rawCdrZip)
            .digest("hex"),
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
      }

      const nextStatus = result.status as DocumentStatus;
      await this.documents.transitionStatus(
        documentId,
        "ticket_pending",
        nextStatus,
        {
          sunatResponseCode: result.sunatCode ?? null,
          sunatResponseMessage: result.sunatMessage ?? null,
          completedAt: new Date(),
        },
      );
      await this.documents.appendEvent({
        organizationId,
        companyId,
        documentId,
        status: nextStatus,
        fromStatus: "ticket_pending",
        detail: result.sunatMessage ?? `GRE ${result.sunatCode ?? nextStatus}`,
        source: "sunat",
        data: { sunat_code: result.sunatCode },
      });

      return { ok: true, status: nextStatus };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "GRE getStatus failed";
      this.logger.error(`sunat-poll GRE failed for ${documentId}: ${message}`);
      throw cause;
    }
  }

  private async processSoapSummary(
    organizationId: string,
    companyId: string,
    documentId: string,
    doc: Awaited<ReturnType<DocumentsService["getById"]>>,
  ): Promise<{ ok: true; status: string }> {
    const sol = await this.credentials.resolveSol(companyId);

    try {
      const result = await this.bill.getStatus({
        ticket: doc.sunatTicket!,
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
      await this.documents.transitionStatus(
        documentId,
        "ticket_pending",
        nextStatus,
        {
          sunatResponseCode: cdr.sunatCode,
          sunatResponseMessage: cdr.sunatMessage ?? null,
          completedAt: new Date(),
        },
      );
      await this.documents.appendEvent({
        organizationId,
        companyId,
        documentId,
        status: nextStatus,
        fromStatus: "ticket_pending",
        detail: cdr.sunatMessage ?? `CDR ${cdr.sunatCode}`,
        source: "sunat",
        data: { sunat_code: cdr.sunatCode },
      });

      if (
        nextStatus === "accepted" ||
        nextStatus === "accepted_with_observation"
      ) {
        if (doc.documentType === "RA") {
          await this.applyRaAccepted(organizationId, companyId, doc);
        } else if (doc.documentType === "RC") {
          await this.applyRcTerminal(
            organizationId,
            companyId,
            doc,
            "accepted",
          );
        }
      } else if (nextStatus === "rejected" && doc.documentType === "RC") {
        await this.applyRcTerminal(organizationId, companyId, doc, "rejected");
      }

      return { ok: true, status: nextStatus };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "getStatus failed";
      this.logger.error(`sunat-poll failed for ${documentId}: ${message}`);
      throw cause;
    }
  }

  private async applyRaAccepted(
    organizationId: string,
    companyId: string,
    raDoc: Awaited<ReturnType<DocumentsService["getById"]>>,
  ): Promise<void> {
    const payload = (raDoc.payload ?? {}) as {
      affected_document_ids?: string[];
    };
    const ids = payload.affected_document_ids ?? [];
    for (const id of ids) {
      try {
        const origin = await this.documents.getById(organizationId, id);
        if (
          origin.status !== "accepted" &&
          origin.status !== "accepted_with_observation"
        ) {
          continue;
        }
        await this.documents.transitionStatus(
          id,
          origin.status as DocumentStatus,
          "cancelled",
          { completedAt: new Date() },
        );
        await this.documents.appendEvent({
          organizationId,
          companyId,
          documentId: id,
          status: "cancelled",
          fromStatus: origin.status,
          detail: `Cancelled by RA ${raDoc.serieNumber ?? raDoc.id}`,
          source: "worker",
          data: { voided_document_id: raDoc.id },
        });
      } catch (err) {
        this.logger.warn(
          `RA side-effect skip ${id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async applyRcTerminal(
    organizationId: string,
    companyId: string,
    rcDoc: Awaited<ReturnType<DocumentsService["getById"]>>,
    summaryStatus: "accepted" | "rejected",
  ): Promise<void> {
    const payload = (rcDoc.payload ?? {}) as {
      pooled_document_ids?: string[];
    };
    const ids = payload.pooled_document_ids ?? [];
    for (const id of ids) {
      try {
        await this.documents.patchPayload(id, {
          summary_status: summaryStatus,
          summary_document_id: rcDoc.id,
        });
        await this.documents.appendEvent({
          organizationId,
          companyId,
          documentId: id,
          status: (await this.documents.getById(organizationId, id)).status,
          detail: `summary_status=${summaryStatus} via RC ${rcDoc.serieNumber ?? rcDoc.id}`,
          source: "worker",
          data: {
            summary_status: summaryStatus,
            daily_summary_id: rcDoc.id,
          },
        });
      } catch (err) {
        this.logger.warn(
          `RC side-effect skip ${id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
