import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";
import { documents, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import {
  SoapCdrConsultAdapter,
  SoapBillServiceAdapter,
  parseCdrZip,
  buildCdrZipFixture,
} from "@factosys/sunat-soap";
import { DB } from "../persistence/db.tokens";
import { DocumentsService } from "./documents.service";
import { CredentialsResolver } from "./credentials-resolver";
import { CompaniesService } from "../companies/companies.service";
import { QueueProducer } from "../queues/queue.producer";
import type { Env } from "../config/env.schema";

@Injectable()
export class CdrRecoveryService {
  private readonly consult = new SoapCdrConsultAdapter();
  private readonly bill = new SoapBillServiceAdapter();
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly docs: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly companies: CompaniesService,
    private readonly queues: QueueProducer,
    private readonly config: ConfigService<Env, true>,
  ) {}
  async recover(org: string, id: string) {
    const doc = await this.docs.getById(org, id);
    const company = await this.companies.requireCompany(org, doc.companyId);
    if (["09", "31"].includes(doc.documentType))
      throw AppError.validation("GRE requires reconcile-ticket with its existing ticket", [], {
        httpStatus: 422,
      });
    const ticketed = ["RA", "RC"].includes(doc.documentType);
    if (
      !ticketed &&
      (!["01", "07", "08"].includes(doc.documentType) || !doc.serie?.startsWith("F"))
    )
      throw AppError.validation(
        "CDR recovery by identifiers supports invoice and F-series notes; recover boletas through their RC ticket",
        [],
        { httpStatus: 422 },
      );
    if (ticketed && !doc.sunatTicket)
      throw AppError.conflict("Summary has no SUNAT ticket; do not resend");
    if (
      !["sent", "failed", "ticket_pending", "accepted", "accepted_with_observation"].includes(
        doc.status,
      )
    )
      throw AppError.conflict("Document cannot be reconciled in current state");
    try {
      await this.docs.getArtifact(org, id, "cdr_xml");
      return this.docs.getDetails(org, id);
    } catch (e) {
      if (!(e instanceof AppError) || e.httpStatus !== 404) throw e;
    }
    if (
      !ticketed &&
      doc.environment === "sandbox" &&
      this.config.get("SUNAT_BILL_MODE", { infer: true }) !== "fake"
    )
      throw AppError.validation("SUNAT publishes identifier CDR recovery in production only", [], {
        httpStatus: 422,
      });
    await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.organizationId, org)))
        .for("update");
      if (!locked) throw AppError.notFound("Document not found");
      if (
        !["sent", "failed", "ticket_pending", "accepted", "accepted_with_observation"].includes(
          locked.status,
        )
      )
        throw AppError.conflict("Fiscal state changed");
      const p = locked.payload as Record<string, unknown> & {
        _reconciliation?: { attempts?: number; started_at?: string; state?: string };
      };
      const r = p._reconciliation;
      if (r?.state === "querying" && Date.now() - Date.parse(r.started_at ?? "") < 120000)
        throw AppError.conflict("CDR consultation already in progress");
      if ((r?.attempts ?? 0) >= 3)
        throw AppError.conflict("CDR recovery limit reached; review with SUNAT");
      await tx
        .update(documents)
        .set({
          payload: {
            ...p,
            _reconciliation: {
              attempts: (r?.attempts ?? 0) + 1,
              state: "querying",
              started_at: new Date().toISOString(),
              simulated: this.config.get("SUNAT_BILL_MODE", { infer: true }) === "fake",
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));
    });
    try {
      if (ticketed && !["accepted", "accepted_with_observation"].includes(doc.status)) {
        if (doc.status === "failed")
          await this.docs.transitionStatus(id, "failed", "ticket_pending");
        await this.metadata(org, id, "ticket_pending");
        await this.queues.enqueue(
          "sunat-poll",
          { organizationId: org, companyId: doc.companyId, documentId: id },
          {
            attempts: 8,
            backoff: { type: "exponential", delay: 3000 },
            jobId: `cdr-poll-${id}-${Date.now()}`,
          },
        );
      } else {
        const sol = await this.credentials.resolveSol(doc.companyId);
        const result =
          this.config.get("SUNAT_BILL_MODE", { infer: true }) === "fake"
            ? {
                statusCode: "fixture",
                rawCdrZip: buildCdrZipFixture("accepted", {
                  documentReferenceId: doc.serieNumber ?? undefined,
                }),
              }
            : ticketed
              ? {
                  statusCode: "ticket",
                  ...(await this.bill.getStatus({
                    ticket: doc.sunatTicket ?? "",
                    solUser: sol.username,
                    solPassword: sol.password,
                  })),
                }
              : await this.consult.getStatusCdr({
                  ruc: company.ruc,
                  documentType: doc.documentType,
                  serie: doc.serie ?? "",
                  number: doc.number ?? 0,
                  solUser: sol.username,
                  solPassword: sol.password,
                });
        if (!result.rawCdrZip?.length) {
          await this.metadata(org, id, "pending", result.statusCode);
          return this.docs.getDetails(org, id);
        }
        const cdr = parseCdrZip(result.rawCdrZip);
        const normalize = (s: string | undefined | null) => s?.replace(/-0+(\d+)$/, "-$1");
        if (
          normalize(cdr.documentId) !== normalize(doc.serieNumber) ||
          (result.statusCode !== "fixture" && cdr.receiverRuc !== company.ruc)
        )
          throw AppError.conflict("Recovered CDR belongs to a different document or issuer");
        await this.db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(documents)
            .where(eq(documents.id, id))
            .for("update");
          if (!current || current.status === "cancelled" || current.status === "rejected")
            throw AppError.conflict("Fiscal state changed while recovering CDR");
          if (
            ["accepted", "accepted_with_observation"].includes(current.status) &&
            cdr.status === "rejected"
          )
            throw AppError.conflict("Recovered CDR contradicts accepted local result");
          await this.docs.putArtifact(
            {
              organizationId: org,
              companyId: doc.companyId,
              documentId: id,
              kind: "cdr_xml",
              body: result.rawCdrZip as Buffer,
              contentType: "application/zip",
              objectKey: `org/${org}/company/${doc.companyId}/document/${id}/cdr/${createHash(
                "sha256",
              )
                .update(result.rawCdrZip as Buffer)
                .digest("hex")}.zip`,
            },
            tx,
          );
          const p = current.payload as Record<string, unknown> & {
            _reconciliation?: Record<string, unknown>;
          };
          await tx
            .update(documents)
            .set({
              status: cdr.status,
              sunatResponseCode: cdr.sunatCode,
              sunatResponseMessage: cdr.sunatMessage ?? null,
              completedAt: new Date(),
              error: null,
              payload: {
                ...p,
                _sunat: { observations: cdr.observations },
                _reconciliation: { ...p._reconciliation, state: "recovered" },
              },
              updatedAt: new Date(),
            })
            .where(eq(documents.id, id));
        });
        await this.docs.appendEvent({
          organizationId: org,
          companyId: doc.companyId,
          documentId: id,
          status: cdr.status,
          source: "sunat",
          detail: "CDR recovered without issuance or correlative allocation",
          data: { sunat_code: cdr.sunatCode },
        });
      }
      return this.docs.getDetails(org, id);
    } catch (cause) {
      await this.metadata(org, id, "transport_error");
      throw cause;
    }
  }
  private async metadata(org: string, id: string, state: string, code?: string) {
    const row = await this.docs.getById(org, id);
    const p = row.payload as { _reconciliation?: Record<string, unknown> };
    await this.docs.patchPayload(id, {
      _reconciliation: { ...p._reconciliation, state, consultation_code: code },
    });
  }
}
