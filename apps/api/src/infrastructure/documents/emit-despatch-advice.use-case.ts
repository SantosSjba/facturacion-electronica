import { assertPlanCapacity, withPlanCapacity } from "../saas/plan-capacity";
import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { and, eq } from "drizzle-orm";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import { createGreClientsFromEnv, packGreZip, type GreDespatchPort } from "@factosys/sunat-gre";
import {
  XmlDespatchAdviceBuilder,
  assertDespatchCanonical,
  despatchCanonicalSchema,
  type DespatchCanonical,
} from "@factosys/sunat-ubl";

import { PDF_TEMPLATE_VERSION } from "@factosys/pdf-ri";
import { XmllintXsdValidationAdapter } from "@factosys/sunat-validation";
import { despatchAdviceCreateSchema } from "../../interfaces/http/dto/despatch-advice-create.schema";
import type { DespatchAdviceCreate } from "../../interfaces/http/dto/despatch-advice-create.schema";
import type { Env } from "../config/env.schema";
import { CompaniesService } from "../companies/companies.service";
import { GreTokenCacheService } from "../gre/gre-token-cache.service";
import { hashRequestBody } from "../idempotency/request-hash";
import { DB } from "../persistence/db.tokens";
import { QueueProducer } from "../queues/queue.producer";
import { SeriesService } from "../series/series.service";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "./credentials-resolver";
import { DocumentsService, type DocumentPublic } from "./documents.service";

@Injectable()
export class EmitDespatchAdviceUseCase {
  private readonly despatch: GreDespatchPort;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly series: SeriesService,
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly greTokens: GreTokenCacheService,
    private readonly queues: QueueProducer,
    config: ConfigService<Env, true>,
  ) {
    process.env["SUNAT_GRE_MODE"] = config.get("SUNAT_GRE_MODE", {
      infer: true,
    });
    process.env["SUNAT_GRE_TOKEN_URL"] = config.get("SUNAT_GRE_TOKEN_URL", {
      infer: true,
    });
    process.env["SUNAT_GRE_API_BASE"] = config.get("SUNAT_GRE_API_BASE", {
      infer: true,
    });
    this.despatch = createGreClientsFromEnv().despatch;
  }

  async reconcileTicket(organizationId: string, documentId: string, ticket: string) {
    const { doc, count } = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)))
        .for("update");
      if (!doc) throw AppError.notFound("Document not found");
      if (!["09", "31"].includes(doc.documentType))
        throw AppError.validation("Only GRE supports ticket reconciliation", [], {
          httpStatus: 422,
        });
      if (!["failed", "ticket_pending"].includes(doc.status))
        throw AppError.conflict("GRE is not pending reconciliation");
      if (doc.sunatTicket && doc.sunatTicket !== ticket)
        throw AppError.conflict("Use the ticket already assigned to this GRE");
      const payload = doc.payload as {
        _gre?: { reconciliation_required?: boolean; reconciliation_count?: number };
      };
      if (!payload?._gre?.reconciliation_required)
        throw AppError.conflict("GRE does not require reconciliation");
      const count = payload._gre.reconciliation_count ?? 0;
      if (count >= 3)
        throw AppError.conflict(
          "Manual reconciliation limit reached; review with SUNAT before retrying",
        );
      // This resumes GET consultarTicket only. CDR identity is checked before accepting the result.
      await tx
        .update(documents)
        .set({
          status: "ticket_pending",
          sunatTicket: ticket,
          error: null,
          updatedAt: new Date(),
          payload: {
            ...(doc.payload as Record<string, unknown>),
            _gre: {
              ...payload._gre,
              reconciliation_required: false,
              reconciliation_count: count + 1,
            },
          },
        })
        .where(eq(documents.id, documentId));
      return { doc, count };
    });
    try {
      await this.queues.enqueue(
        "sunat-poll",
        { organizationId, companyId: doc.companyId, documentId },
        {
          attempts: 8,
          backoff: { type: "exponential", delay: 3000 },
          jobId: `gre-reconcile-${documentId}-${count + 1}`,
        },
      );
    } catch (cause) {
      await this.documents.patchPayload(documentId, {
        _gre: {
          reconciliation_required: true,
          reason: "poll_enqueue_failed",
          reconciliation_count: count + 1,
        },
      });
      throw cause;
    }
    await this.documents.appendEvent({
      organizationId,
      companyId: doc.companyId,
      documentId,
      status: "ticket_pending",
      source: "api",
      detail: "GRE reconciliation with existing SUNAT ticket; no resend",
    });
    return this.documents.toPublic(await this.documents.getById(organizationId, documentId));
  }

  async requireCompanyAccess(organizationId: string, companyId: string) {
    await this.companies.requireActiveCompany(organizationId, companyId);
  }

  async execute(input: {
    organizationId: string;
    body: DespatchAdviceCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    const parsed = despatchAdviceCreateSchema.safeParse(input.body);
    if (!parsed.success)
      throw AppError.validation(
        "Invalid GRE",
        parsed.error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })),
        { httpStatus: 422 },
      );
    input.body = parsed.data;
    await assertPlanCapacity(this.db, input.organizationId, "documents_this_month");
    const company = await this.companies.requireActiveCompany(
      input.organizationId,
      input.body.company_id,
    );
    const serie = input.body.serie.toUpperCase();
    const canonicalResult = despatchCanonicalSchema.safeParse({
      document_type: input.body.document_type,
      serie,
      number: 1,
      issue_date: input.body.issue_date,
      issue_time: input.body.issue_time,
      notes: input.body.notes,
      supplier: {
        identity_type: "6",
        identity_number: company.ruc,
        name: company.legalName,
      },
      shipper: input.body.shipper,
      delivery_customer: input.body.delivery_customer,
      supplier_party: input.body.supplier,
      buyer: input.body.buyer,
      shipment: input.body.shipment,
      related_documents: input.body.related_documents,
      lines: input.body.lines,
    } satisfies DespatchCanonical);
    if (!canonicalResult.success)
      throw AppError.validation(
        "Invalid GRE issuer-dependent fields",
        canonicalResult.error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })),
        { httpStatus: 422, stage: "prevalidation" },
      );
    const prevalidated = canonicalResult.data;

    const { pfx, password } = await this.credentials.resolveCertificate(company.id);
    // Ensure GRE + SOL are configured (token cache will fetch)
    await this.credentials.resolveGre(company.id);
    await this.credentials.resolveSol(company.id);

    const allocated = await this.series.allocateNextNumber({
      organizationId: input.organizationId,
      companyId: company.id,
      documentType: input.body.document_type,
      serie,
    });

    let liberated = false;
    const liberate = async () => {
      if (!liberated) {
        liberated = true;
        await this.series.liberateNumber({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: input.body.document_type,
          serie,
          number: allocated.number,
        });
      }
    };

    const documentId = newId();
    let persisted = false;
    let submitted = false;
    try {
      const canonical = assertDespatchCanonical({ ...prevalidated, number: allocated.number });

      const { xml } = new XmlDespatchAdviceBuilder().build(canonical);
      const validation = await new XmllintXsdValidationAdapter().validateXml({
        documentType: canonical.document_type,
        xml,
        stages: ["xsd"],
      });
      if (!validation.ok)
        throw AppError.validation(
          "GRE XML failed UBL XSD validation",
          validation.issues.map((i) => ({ path: i.path, issue: i.message })),
          { httpStatus: 422, stage: "prevalidation" },
        );
      const { signedXml } = await new XmlCryptoSignAdapter().sign({
        xml,
        certificate: pfx,
        password,
      });
      const packed = packGreZip({
        ruc: company.ruc,
        documentType: input.body.document_type,
        serie,
        number: allocated.number,
        xml: signedXml,
      });

      const serieNumber = `${serie}-${allocated.padded}`;
      const payload = {
        ...input.body,
        _canonical: canonical,
        _print: { format: company.pdfFormat ?? "A4", template_version: PDF_TEMPLATE_VERSION },
      };

      await withPlanCapacity(this.db, input.organizationId, "documents_this_month", async (tx) =>
        tx.insert(documents).values({
          id: documentId,
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: input.body.document_type,
          serie,
          number: allocated.number,
          serieNumber,
          status: "draft",
          environment: company.environment,
          issueDate: input.body.issue_date,
          currency: null,
          customerIdentityType: input.body.delivery_customer.identity_type,
          customerIdentityNumber: input.body.delivery_customer.identity_number,
          customerName: input.body.delivery_customer.name,
          totals: {},
          payload,
          logoSnapshot: { logo: company.logo ?? null },
          payloadHash: hashRequestBody(input.body),
          idempotencyKey: input.idempotencyKey,
          ublProfile: "2.1",
        }),
      );

      persisted = true;

      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "draft",
        detail: "Despatch advice created",
        source: "api",
      });

      await this.documents.transitionStatus(documentId, "draft", "validated");
      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "validated",
        fromStatus: "draft",
        detail: "GRE signed",
        source: "api",
      });

      await this.documents.putArtifact({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        kind: "xml_signed",
        body: Buffer.from(signedXml, "utf8"),
        contentType: "application/xml",
        objectKey: buildDocumentObjectKey({
          organizationId: input.organizationId,
          companyId: company.id,
          documentId,
          kind: "xml_signed",
          sha256: createHash("sha256").update(signedXml, "utf8").digest("hex"),
          ext: "xml",
        }),
      });

      await this.documents.putArtifact({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        kind: "zip",
        body: packed.zipBytes,
        contentType: "application/zip",
        objectKey: buildDocumentObjectKey({
          organizationId: input.organizationId,
          companyId: company.id,
          documentId,
          kind: "zip",
          sha256: createHash("sha256").update(packed.zipBytes).digest("hex"),
          ext: "zip",
        }),
      });

      let accessToken = await this.greTokens.getAccessToken(company.id);
      let sent;
      submitted = true;
      try {
        sent = await this.despatch.sendDespatch({
          accessToken,
          zipBytes: packed.zipBytes,
          fileName: packed.fileName,
          ruc: company.ruc,
          documentType: input.body.document_type,
          serie,
          number: allocated.number,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/401|Unauthorized|OAuth|accessToken/i.test(msg)) {
          throw err;
        }
        await this.greTokens.invalidate(company.id);
        accessToken = await this.greTokens.getAccessToken(company.id);
        sent = await this.despatch.sendDespatch({
          accessToken,
          zipBytes: packed.zipBytes,
          fileName: packed.fileName,
          ruc: company.ruc,
          documentType: input.body.document_type,
          serie,
          number: allocated.number,
        });
      }

      await this.documents.transitionStatus(documentId, "validated", "ticket_pending", {
        sunatTicket: sent.ticket,
        sentAt: new Date(),
      });
      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "ticket_pending",
        fromStatus: "validated",
        detail: `GRE sendDespatch ticket=${sent.ticket}`,
        source: "api",
        data: { sunat_ticket: sent.ticket },
      });

      await this.queues.enqueue(
        "sunat-poll",
        {
          organizationId: input.organizationId,
          companyId: company.id,
          documentId,
        },
        {
          attempts: 8,
          backoff: { type: "exponential", delay: 3000 },
          jobId: `gre-poll-${documentId}`,
        },
      );

      const row = await this.documents.getById(input.organizationId, documentId);
      return this.documents.toPublic(row);
    } catch (cause) {
      if (!persisted) await liberate();
      else {
        // Preserve the fiscal identifier even when an HTTP timeout obscures SUNAT's result.
        const current = await this.documents.getById(input.organizationId, documentId);
        const appError = cause instanceof AppError ? cause : undefined;
        await this.documents.patchPayload(documentId, {
          _gre: {
            reconciliation_required: submitted,
            reason:
              appError?.sunatCode === "1033"
                ? "duplicate_1033"
                : submitted
                  ? "submission_uncertain"
                  : "local_failure",
            sunat_code: appError?.sunatCode,
          },
        });
        if (current.status === "validated" || current.status === "draft") {
          await this.documents.transitionStatus(documentId, current.status, "failed", {
            error: {
              code: submitted ? "GRE_RECONCILIATION_REQUIRED" : "GRE_LOCAL_FAILURE",
              message: "GRE retained; inspect trace and reconcile before any resend",
              sunat_code: appError?.sunatCode,
            },
          });
        }
        await this.documents.appendEvent({
          organizationId: input.organizationId,
          companyId: company.id,
          documentId,
          status: ["validated", "draft"].includes(current.status) ? "failed" : current.status,
          source: "api",
          detail: "GRE failure: identifier retained; no automatic resend",
          data: { sunat_code: appError?.sunatCode },
        });
        return this.documents.toPublic(
          await this.documents.getById(input.organizationId, documentId),
        );
      }
      if (cause instanceof AppError) throw cause;
      throw AppError.internal(cause instanceof Error ? cause.message : "Emit GRE failed", {
        cause,
      });
    }
  }
}
