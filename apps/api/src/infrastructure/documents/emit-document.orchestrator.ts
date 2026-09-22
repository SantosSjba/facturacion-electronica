import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { CompaniesService } from "../companies/companies.service";
import { hashRequestBody } from "../idempotency/request-hash";
import { withSpan } from "../observability/otel";
import { QueueProducer } from "../queues/queue.producer";
import { DB } from "../persistence/db.tokens";
import { SeriesService } from "../series/series.service";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "./credentials-resolver";
import { DocumentsService, type DocumentPublic } from "./documents.service";

export type EmitDocumentType = "01" | "03" | "07" | "08";

export interface EmitBuiltPayload {
  serie: string;
  number: number;
  padded: string;
  totals: Record<string, unknown>;
  signedXml: string;
  zipBytes: Buffer;
  relatedDocumentId?: string;
}

export interface EmitDocumentParams {
  organizationId: string;
  companyId: string;
  documentType: EmitDocumentType;
  serie: string;
  issueDate: string;
  currency: string;
  customer: {
    identity_type: string;
    identity_number: string;
    name: string;
  };
  payload: unknown;
  idempotencyKey: string;
  relatedDocumentId?: string;
  build: (ctx: {
    company: { id: string; ruc: string; legalName: string; environment: string };
    allocated: { number: number; padded: string };
    pfx: Buffer;
    password: string;
  }) => Promise<EmitBuiltPayload>;
}

/**
 * Shared emit pipeline: allocate → build/sign/zip → draft→validated→queued → enqueue.
 * Liberates correlative on failure before wire (ADR-001).
 */
@Injectable()
export class EmitDocumentOrchestrator {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly series: SeriesService,
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly queues: QueueProducer,
  ) {}

  async execute(input: EmitDocumentParams): Promise<DocumentPublic> {
    return withSpan(
      "emit.document",
      {
        "factosys.company_id": input.companyId,
        "factosys.document_type": input.documentType,
        "factosys.organization_id": input.organizationId,
      },
      async (rootSpan) => {
        const company = await this.companies.requireCompany(
          input.organizationId,
          input.companyId,
        );

        const { pfx, password } = await withSpan(
          "emit.validate",
          { "factosys.step": "credentials" },
          async () => {
            const cert = await this.credentials.resolveCertificate(company.id);
            await this.credentials.resolveSol(company.id);
            return cert;
          },
        );

        const allocated = await this.series.allocateNextNumber({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: input.documentType,
          serie: input.serie,
        });

        const documentId = newId();
        rootSpan.setAttribute("factosys.document_id", documentId);

        let liberated = false;
        const liberate = async () => {
          if (!liberated) {
            liberated = true;
            await this.series.liberateNumber({
              organizationId: input.organizationId,
              companyId: company.id,
              documentType: input.documentType,
              serie: input.serie,
              number: allocated.number,
            });
          }
        };

        try {
          const built = await withSpan(
            "emit.sign",
            { "factosys.step": "build_sign_zip" },
            async () =>
              input.build({
                company,
                allocated,
                pfx,
                password,
              }),
          );

          const serieNumber = `${built.serie.toUpperCase()}-${built.padded}`;
          const payloadHash = hashRequestBody(input.payload);

          await withSpan(
            "emit.persist",
            { "factosys.step": "persist_artifacts" },
            async () => {
              await this.db.insert(documents).values({
                id: documentId,
                organizationId: input.organizationId,
                companyId: company.id,
                documentType: input.documentType,
                serie: built.serie.toUpperCase(),
                number: built.number,
                serieNumber,
                status: "draft",
                environment: company.environment,
                issueDate: input.issueDate,
                currency: input.currency,
                customerIdentityType: input.customer.identity_type,
                customerIdentityNumber: input.customer.identity_number,
                customerName: input.customer.name,
                totals: built.totals,
                payload: input.payload as Record<string, unknown>,
                payloadHash,
                idempotencyKey: input.idempotencyKey,
                ublProfile: "2.1",
                relatedDocumentId:
                  built.relatedDocumentId ?? input.relatedDocumentId ?? null,
              });

              await this.documents.appendEvent({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                status: "draft",
                detail: "Document created",
                source: "api",
              });

              await this.documents.transitionStatus(
                documentId,
                "draft",
                "validated",
              );
              await this.documents.appendEvent({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                status: "validated",
                fromStatus: "draft",
                detail: "UBL signed and validated locally",
                source: "api",
              });

              const xmlKey = buildDocumentObjectKey({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                kind: "xml_signed",
                sha256: createHash("sha256")
                  .update(built.signedXml, "utf8")
                  .digest("hex"),
                ext: "xml",
              });
              await this.documents.putArtifact({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                kind: "xml_signed",
                body: Buffer.from(built.signedXml, "utf8"),
                contentType: "application/xml",
                objectKey: xmlKey,
              });

              const zipSha = createHash("sha256")
                .update(built.zipBytes)
                .digest("hex");
              const zipKey = buildDocumentObjectKey({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                kind: "zip",
                sha256: zipSha,
                ext: "zip",
              });
              await this.documents.putArtifact({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                kind: "zip",
                body: built.zipBytes,
                contentType: "application/zip",
                objectKey: zipKey,
              });

              await this.documents.transitionStatus(
                documentId,
                "validated",
                "queued",
                { queuedAt: new Date() },
              );
              await this.documents.appendEvent({
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
                status: "queued",
                fromStatus: "validated",
                detail: "Enqueued sunat-send",
                source: "api",
              });
            },
          );

          await withSpan(
            "emit.enqueue",
            { "factosys.queue": "sunat-send" },
            async () => {
              await this.queues.enqueue("sunat-send", {
                organizationId: input.organizationId,
                companyId: company.id,
                documentId,
              });
            },
          );

          const row = await this.documents.getById(
            input.organizationId,
            documentId,
          );
          return this.documents.toPublic(row);
        } catch (cause) {
          await liberate();
          if (cause instanceof AppError) {
            throw cause;
          }
          throw AppError.internal(
            cause instanceof Error ? cause.message : "Emit document failed",
            { cause },
          );
        }
      },
    );
  }
}
