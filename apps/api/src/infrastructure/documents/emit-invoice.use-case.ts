import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  hydrateFromFixtureRequest,
  XmlInvoiceBuilder,
  type InvoiceFixtureRequest,
} from "@factosys/sunat-ubl";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import { packInvoiceZip } from "@factosys/sunat-soap";
import { documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { InvoiceCreate } from "../../interfaces/http/dto/invoice-create.schema";
import { CompaniesService } from "../companies/companies.service";
import { hashRequestBody } from "../idempotency/request-hash";
import { QueueProducer } from "../queues/queue.producer";
import { DB } from "../persistence/db.tokens";
import { SeriesService } from "../series/series.service";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { CredentialsResolver } from "./credentials-resolver";
import { DocumentsService, type DocumentPublic } from "./documents.service";

@Injectable()
export class EmitInvoiceUseCase {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companies: CompaniesService,
    private readonly series: SeriesService,
    private readonly documents: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly queues: QueueProducer,
  ) {}

  async execute(input: {
    organizationId: string;
    body: InvoiceCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    const company = await this.companies.requireCompany(
      input.organizationId,
      input.body.company_id,
    );

    const { pfx, password } = await this.credentials.resolveCertificate(
      company.id,
    );
    // Ensure SOL exists before queue (worker will use it)
    await this.credentials.resolveSol(company.id);

    const allocated = await this.series.allocateNextNumber({
      organizationId: input.organizationId,
      companyId: company.id,
      documentType: "01",
      serie: input.body.serie,
    });

    const documentId = newId();
    let liberated = false;
    const liberate = async () => {
      if (!liberated) {
        liberated = true;
        await this.series.liberateNumber({
          organizationId: input.organizationId,
          companyId: company.id,
          documentType: "01",
          serie: input.body.serie,
          number: allocated.number,
        });
      }
    };

    try {
      const fixtureRequest: InvoiceFixtureRequest = {
        company_id: company.id,
        serie: input.body.serie.toUpperCase(),
        operation_type: input.body.operation_type,
        issue_date: input.body.issue_date,
        currency: input.body.currency,
        totals_mode: input.body.totals_mode ?? "auto",
        customer: {
          identity_type: input.body.customer.identity_type,
          identity_number: input.body.customer.identity_number,
          name: input.body.customer.name,
        },
        lines: input.body.lines.map((l) => ({
          id: l.id,
          quantity: l.quantity,
          unit_code: l.unit_code,
          description: l.description,
          unit_value: l.unit_value,
          unit_price: l.unit_price,
          tax_affectation: l.tax_affectation,
          igv_percent: l.igv_percent,
          tax_scheme_id: l.tax_scheme_id,
        })),
      };

      const canonical = hydrateFromFixtureRequest(fixtureRequest, {
        supplier: {
          identity_type: "6",
          identity_number: company.ruc,
          name: company.legalName,
        },
        number: allocated.number,
      });

      const { xml } = new XmlInvoiceBuilder().build(canonical);
      const { signedXml } = await new XmlCryptoSignAdapter().sign({
        xml,
        certificate: pfx,
        password,
      });
      const packed = packInvoiceZip({
        ruc: company.ruc,
        documentType: "01",
        serie: canonical.serie,
        number: canonical.number,
        xml: signedXml,
      });

      const serieNumber = `${canonical.serie.toUpperCase()}-${allocated.padded}`;
      const payloadHash = hashRequestBody(input.body);

      await this.db.insert(documents).values({
        id: documentId,
        organizationId: input.organizationId,
        companyId: company.id,
        documentType: "01",
        serie: canonical.serie.toUpperCase(),
        number: allocated.number,
        serieNumber,
        status: "draft",
        environment: company.environment,
        issueDate: input.body.issue_date,
        currency: input.body.currency,
        customerIdentityType: input.body.customer.identity_type,
        customerIdentityNumber: input.body.customer.identity_number,
        customerName: input.body.customer.name,
        totals: canonical.totals,
        payload: input.body as unknown as Record<string, unknown>,
        payloadHash,
        idempotencyKey: input.idempotencyKey,
        ublProfile: "2.1",
      });

      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "draft",
        detail: "Document created",
        source: "api",
      });

      await this.documents.transitionStatus(documentId, "draft", "validated");
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
        body: packed.zipBytes,
        contentType: "application/zip",
        objectKey: zipKey,
      });

      await this.documents.transitionStatus(documentId, "validated", "queued", {
        queuedAt: new Date(),
      });
      await this.documents.appendEvent({
        organizationId: input.organizationId,
        companyId: company.id,
        documentId,
        status: "queued",
        fromStatus: "validated",
        detail: "Enqueued sunat-send",
        source: "api",
      });

      await this.queues.enqueue("sunat-send", {
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
      if (cause instanceof AppError) {
        throw cause;
      }
      throw AppError.internal(
        cause instanceof Error ? cause.message : "EmitInvoice failed",
        { cause },
      );
    }
  }
}
