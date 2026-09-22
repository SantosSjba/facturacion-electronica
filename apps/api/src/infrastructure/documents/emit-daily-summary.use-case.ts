import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import {
  createBillServiceFromEnv,
  packSummaryZip,
  type BillServicePort,
} from "@factosys/sunat-soap";
import { XmlSummaryDocumentsBuilder } from "@factosys/sunat-ubl";

import type { DailySummaryCreate } from "../../interfaces/http/dto/daily-summary-create.schema";
import type { Env } from "../config/env.schema";
import { CompaniesService } from "../companies/companies.service";
import { hashRequestBody } from "../idempotency/request-hash";
import { DB } from "../persistence/db.tokens";
import { QueueProducer } from "../queues/queue.producer";
import { SeriesService } from "../series/series.service";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "./credentials-resolver";
import { DocumentsService, type DocumentPublic } from "./documents.service";
import { SummaryPoolService } from "./summary-pool.service";

@Injectable()
export class EmitDailySummaryUseCase {
  private readonly bill: BillServicePort;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly series: SeriesService,
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly queues: QueueProducer,
    private readonly pool: SummaryPoolService,
    config: ConfigService<Env, true>,
  ) {
    process.env["SUNAT_BILL_MODE"] = config.get("SUNAT_BILL_MODE", {
      infer: true,
    });
    this.bill = createBillServiceFromEnv();
  }

  async execute(input: {
    organizationId: string;
    body: DailySummaryCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    const company = await this.companies.requireCompany(
      input.organizationId,
      input.body.company_id,
    );
    const { pfx, password } = await this.credentials.resolveCertificate(
      company.id,
    );
    const sol = await this.credentials.resolveSol(company.id);

    const issueDate =
      input.body.issue_date ?? new Date().toISOString().slice(0, 10);
    const dateCompact = input.body.reference_date.replace(/-/g, "");

    const poolLines = await this.pool.resolvePool({
      organizationId: input.organizationId,
      companyId: company.id,
      referenceDate: input.body.reference_date,
      documentIds: input.body.document_ids,
      lineOverrides: input.body.lines?.map((l) => ({
        document_id: l.document_id,
        status: l.status,
      })),
    });

    const allocated = await this.series.allocateNextNumber({
      organizationId: input.organizationId,
      companyId: company.id,
      documentType: "RC",
      serie: dateCompact,
    });

    let liberated = false;
    const liberate = async () => {
      if (!liberated) {
        liberated = true;
        await this.series.liberateNumber({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: "RC",
          serie: dateCompact,
          number: allocated.number,
        });
      }
    };

    const documentId = newId();
    try {
      const ublId = `RC-${dateCompact}-${allocated.padded}`;
      const { xml } = new XmlSummaryDocumentsBuilder().build({
        id: ublId,
        reference_date: input.body.reference_date,
        issue_date: issueDate,
        supplier: {
          identity_type: "6",
          identity_number: company.ruc,
          name: company.legalName,
        },
        lines: poolLines.map((l, idx) => ({
          line_id: idx + 1,
          document_type: l.documentType,
          serie_number: l.serieNumber,
          status: l.status,
          customer: l.customer,
          totals: l.totals,
          affected_document: l.affectedDocument,
        })),
      });

      const { signedXml } = await new XmlCryptoSignAdapter().sign({
        xml,
        certificate: pfx,
        password,
      });
      const packed = packSummaryZip({
        ruc: company.ruc,
        kind: "RC",
        referenceDateCompact: dateCompact,
        correlative: allocated.number,
        xml: signedXml,
      });

      const pooledIds = poolLines.map((l) => l.documentId);
      const payload = {
        ...input.body,
        pooled_document_ids: pooledIds,
      };

      // Mark pooled docs as included before send
      for (const id of pooledIds) {
        await this.documents.patchPayload(id, {
          summary_status: "included",
          summary_document_id: documentId,
        });
      }

      await this.db.insert(documents).values({
        id: documentId,
        organizationId: input.organizationId,
        companyId: company.id,
        documentType: "RC",
        serie: dateCompact,
        number: allocated.number,
        serieNumber: ublId,
        status: "draft",
        environment: company.environment,
        issueDate,
        currency: "PEN",
        customerIdentityType: null,
        customerIdentityNumber: null,
        customerName: null,
        totals: {},
        payload,
        payloadHash: hashRequestBody(payload),
        idempotencyKey: input.idempotencyKey,
        ublProfile: "2.0",
      });

      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "draft",
        detail: "Daily summary created",
        source: "api",
      });

      await this.documents.transitionStatus(documentId, "draft", "validated");
      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "validated",
        fromStatus: "draft",
        detail: "RC signed",
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

      const summary = await this.bill.sendSummary({
        zipBytes: packed.zipBytes,
        fileName: packed.fileName,
        solUser: sol.username,
        solPassword: sol.password,
      });

      await this.documents.transitionStatus(
        documentId,
        "validated",
        "ticket_pending",
        {
          sunatTicket: summary.ticket,
          sentAt: new Date(),
        },
      );
      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "ticket_pending",
        fromStatus: "validated",
        detail: `SendSummary ticket=${summary.ticket}`,
        source: "api",
        data: { sunat_ticket: summary.ticket },
      });

      await this.queues.enqueue("sunat-poll", {
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
      });

      const row = await this.documents.getById(
        input.organizationId,
        documentId,
      );
      return this.documents.toPublic(row);
    } catch (cause) {
      await liberate();
      if (cause instanceof AppError) throw cause;
      throw AppError.internal(
        cause instanceof Error ? cause.message : "Emit RC failed",
        { cause },
      );
    }
  }
}
