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
import { XmlVoidedDocumentsBuilder } from "@factosys/sunat-ubl";

import type { VoidedDocumentCreate } from "../../interfaces/http/dto/voided-document-create.schema";
import type { Env } from "../config/env.schema";
import { CompaniesService } from "../companies/companies.service";
import { hashRequestBody } from "../idempotency/request-hash";
import { DB } from "../persistence/db.tokens";
import { QueueProducer } from "../queues/queue.producer";
import { SeriesService } from "../series/series.service";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "./credentials-resolver";
import { DocumentsService, type DocumentPublic } from "./documents.service";

function parseSerieNumber(raw: string): { serie: string; number: number } {
  const m = raw.trim().toUpperCase().match(/^([A-Z0-9]+)-(\d+)$/);
  if (!m?.[1] || !m[2]) {
    throw AppError.validation("Invalid serie_number", [
      { path: "serie_number", issue: "expected SERIE-NUMBER" },
    ], { httpStatus: 422 });
  }
  return { serie: m[1], number: Number(m[2]) };
}

@Injectable()
export class EmitVoidedDocumentUseCase {
  private readonly bill: BillServicePort;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly series: SeriesService,
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly queues: QueueProducer,
    config: ConfigService<Env, true>,
  ) {
    process.env["SUNAT_BILL_MODE"] = config.get("SUNAT_BILL_MODE", {
      infer: true,
    });
    this.bill = createBillServiceFromEnv();
  }

  async execute(input: {
    organizationId: string;
    body: VoidedDocumentCreate;
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

    const affectedIds: string[] = [];
    const lines = [];
    let lineId = 1;
    for (const doc of input.body.documents) {
      let serie: string;
      let number: number;
      if (doc.serie_number) {
        const parsed = parseSerieNumber(doc.serie_number);
        serie = parsed.serie;
        number = parsed.number;
      } else {
        serie = (doc.serie ?? "").toUpperCase();
        number = doc.number ?? 0;
      }
      if (!serie || !number) {
        throw AppError.validation("Missing serie/number", [
          { path: "documents", issue: "serie_number or serie+number required" },
        ], { httpStatus: 422 });
      }
      const serieNumber = `${serie}-${String(number).padStart(8, "0")}`;
      // Also try unpadded forms used by emit (padding from series)
      let origin;
      try {
        origin = await this.documents.requireAcceptedAffected({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: doc.document_type,
          serieNumber,
        });
      } catch {
        const alt = `${serie}-${number}`;
        origin = await this.documents.requireAcceptedAffected({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: doc.document_type,
          serieNumber: alt.toUpperCase(),
        });
      }
      if (!["01", "07", "08"].includes(origin.documentType)) {
        throw AppError.validation("RA only for 01/07/08", [
          { path: "documents", issue: `type ${origin.documentType}` },
        ], { httpStatus: 422 });
      }
      affectedIds.push(origin.id);
      lines.push({
        line_id: doc.line_id ?? lineId,
        document_type: doc.document_type,
        serie: origin.serie ?? serie,
        number: origin.number ?? number,
        reason: doc.reason,
      });
      lineId += 1;
    }

    const allocated = await this.series.allocateNextNumber({
      organizationId: input.organizationId,
      companyId: company.id,
      documentType: "RA",
      serie: dateCompact,
    });

    let liberated = false;
    const liberate = async () => {
      if (!liberated) {
        liberated = true;
        await this.series.liberateNumber({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: "RA",
          serie: dateCompact,
          number: allocated.number,
        });
      }
    };

    const documentId = newId();
    try {
      const ublId = `RA-${dateCompact}-${allocated.padded}`;
      const { xml } = new XmlVoidedDocumentsBuilder().build({
        id: ublId,
        reference_date: input.body.reference_date,
        issue_date: issueDate,
        supplier: {
          identity_type: "6",
          identity_number: company.ruc,
          name: company.legalName,
        },
        lines,
      });
      const { signedXml } = await new XmlCryptoSignAdapter().sign({
        xml,
        certificate: pfx,
        password,
      });
      const packed = packSummaryZip({
        ruc: company.ruc,
        kind: "RA",
        referenceDateCompact: dateCompact,
        correlative: allocated.number,
        xml: signedXml,
      });

      const payload = {
        ...input.body,
        affected_document_ids: affectedIds,
      };

      await this.db.insert(documents).values({
        id: documentId,
        organizationId: input.organizationId,
        companyId: company.id,
        documentType: "RA",
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
        detail: "Voided document created",
        source: "api",
      });

      await this.documents.transitionStatus(documentId, "draft", "validated");
      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "validated",
        fromStatus: "draft",
        detail: "RA signed",
        source: "api",
      });

      const xmlKey = buildDocumentObjectKey({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        kind: "xml_signed",
        sha256: createHash("sha256").update(signedXml, "utf8").digest("hex"),
        ext: "xml",
      });
      await this.documents.putArtifact({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        kind: "xml_signed",
        body: Buffer.from(signedXml, "utf8"),
        contentType: "application/xml",
        objectKey: xmlKey,
      });

      const zipSha = createHash("sha256").update(packed.zipBytes).digest("hex");
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
          sha256: zipSha,
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
        cause instanceof Error ? cause.message : "Emit RA failed",
        { cause },
      );
    }
  }
}
