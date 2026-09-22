import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { documents, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import {
  createGreClientsFromEnv,
  packGreZip,
  type GreDespatchPort,
} from "@factosys/sunat-gre";
import {
  XmlDespatchAdviceBuilder,
  assertDespatchCanonical,
  type DespatchCanonical,
} from "@factosys/sunat-ubl";

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

  async execute(input: {
    organizationId: string;
    body: DespatchAdviceCreate;
    idempotencyKey: string;
  }): Promise<DocumentPublic> {
    const company = await this.companies.requireCompany(
      input.organizationId,
      input.body.company_id,
    );
    const { pfx, password } = await this.credentials.resolveCertificate(
      company.id,
    );
    // Ensure GRE + SOL are configured (token cache will fetch)
    await this.credentials.resolveGre(company.id);
    await this.credentials.resolveSol(company.id);

    const serie = input.body.serie.toUpperCase();
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
    try {
      const canonical = assertDespatchCanonical({
        document_type: input.body.document_type,
        serie,
        number: allocated.number,
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
        shipment: {
          ...input.body.shipment,
          carrier:
            input.body.shipment.carrier?.identity_type &&
            input.body.shipment.carrier.identity_number &&
            input.body.shipment.carrier.name
              ? {
                  identity_type: input.body.shipment.carrier.identity_type,
                  identity_number: input.body.shipment.carrier.identity_number,
                  name: input.body.shipment.carrier.name,
                  mtc_registration:
                    input.body.shipment.carrier.mtc_registration,
                }
              : undefined,
        },
        related_documents: input.body.related_documents,
        lines: input.body.lines,
      } satisfies DespatchCanonical);

      const { xml } = new XmlDespatchAdviceBuilder().build(canonical);
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
      const payload = input.body;

      await this.db.insert(documents).values({
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
        payloadHash: hashRequestBody(payload),
        idempotencyKey: input.idempotencyKey,
        ublProfile: "2.1",
      });

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

      await this.documents.transitionStatus(
        documentId,
        "validated",
        "ticket_pending",
        {
          sunatTicket: sent.ticket,
          sentAt: new Date(),
        },
      );
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
        cause instanceof Error ? cause.message : "Emit GRE failed",
        { cause },
      );
    }
  }
}
