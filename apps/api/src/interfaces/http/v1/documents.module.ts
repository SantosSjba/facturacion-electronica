import { TaxAgentService } from "../../../infrastructure/documents/tax-agent.service";
import { TaxAgentsController } from "./tax-agents.controller";
import { Inject, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Worker, type ConnectionOptions } from "bullmq";

import { EmitDocumentOrchestrator } from "../../../infrastructure/documents/emit-document.orchestrator";
import { EmitInvoiceUseCase } from "../../../infrastructure/documents/emit-invoice.use-case";
import {
  EmitCreditNoteUseCase,
  EmitDebitNoteUseCase,
} from "../../../infrastructure/documents/emit-note.use-case";
import { EmitReceiptUseCase } from "../../../infrastructure/documents/emit-receipt.use-case";
import { EmitVoidedDocumentUseCase } from "../../../infrastructure/documents/emit-voided-document.use-case";
import { EmitDailySummaryUseCase } from "../../../infrastructure/documents/emit-daily-summary.use-case";
import { EmitDespatchAdviceUseCase } from "../../../infrastructure/documents/emit-despatch-advice.use-case";
import { SummaryPoolService } from "../../../infrastructure/documents/summary-pool.service";
import { CredentialsResolver } from "../../../infrastructure/documents/credentials-resolver";
import { DocumentsService } from "../../../infrastructure/documents/documents.service";
import { GreTokenCacheService } from "../../../infrastructure/gre/gre-token-cache.service";
import { IdempotencyModule } from "../../../infrastructure/idempotency/idempotency.module";
import { BULLMQ_CONNECTION, type QueueJobData } from "../../../infrastructure/queues/queue.tokens";
import { SunatSendProcessor } from "../../../infrastructure/queues/sunat-send.processor";
import { SunatPollProcessor } from "../../../infrastructure/queues/sunat-poll.processor";
import { CompaniesModule } from "../companies/companies.module";
import { WebhooksModule } from "./webhooks.module";
import { DocumentsController } from "./documents.controller";
import { InvoicesController } from "./invoices.controller";
import { CreditNotesController, DebitNotesController } from "./notes.controller";
import { ReceiptsController } from "./receipts.controller";
import { VoidedDocumentsController } from "./voided-documents.controller";
import { DailySummariesController } from "./daily-summaries.controller";
import { DespatchAdvicesController } from "./despatch-advices.controller";
import { PdfRenderProcessor } from "../../../infrastructure/pdf/pdf-render.processor";
import { PreviewService } from "../../../infrastructure/pdf/preview.service";
import { PreviewsController } from "./previews.controller";
import { PdfService } from "../../../infrastructure/pdf/pdf.service";
import { CdrRecoveryService } from "../../../infrastructure/documents/cdr-recovery.service";
import { DocumentDeliveryService } from "../../../infrastructure/documents/document-delivery.service";
import { DocumentAccessService } from "../../../infrastructure/documents/document-access.service";
import { EmailService } from "../../../infrastructure/notifications/email.service";
import {
  DocumentIntegrationController,
  SharedDocumentsController,
} from "./document-integration.controller";
import { CapabilitiesController } from "./capabilities.controller";

@Module({
  imports: [CompaniesModule, IdempotencyModule, WebhooksModule],
  controllers: [
    PreviewsController,
    DocumentIntegrationController,
    SharedDocumentsController,
    CapabilitiesController,
    TaxAgentsController,
    InvoicesController,
    ReceiptsController,
    CreditNotesController,
    DebitNotesController,
    VoidedDocumentsController,
    DailySummariesController,
    DespatchAdvicesController,
    DocumentsController,
  ],
  providers: [
    TaxAgentService,
    DocumentsService,
    CredentialsResolver,
    GreTokenCacheService,
    EmitDocumentOrchestrator,
    EmitInvoiceUseCase,
    EmitReceiptUseCase,
    EmitCreditNoteUseCase,
    EmitDebitNoteUseCase,
    EmitVoidedDocumentUseCase,
    EmitDailySummaryUseCase,
    EmitDespatchAdviceUseCase,
    SummaryPoolService,
    SunatSendProcessor,
    SunatPollProcessor,
    PreviewService,
    PdfService,
    CdrRecoveryService,
    DocumentDeliveryService,
    DocumentAccessService,
    EmailService,
    PdfRenderProcessor,
  ],
  exports: [
    TaxAgentService,
    DocumentsService,
    EmitInvoiceUseCase,
    EmitReceiptUseCase,
    EmitCreditNoteUseCase,
    EmitDebitNoteUseCase,
    EmitVoidedDocumentUseCase,
    EmitDailySummaryUseCase,
    EmitDespatchAdviceUseCase,
    PreviewService,
    PdfService,
  ],
})
export class DocumentsModule implements OnModuleInit, OnModuleDestroy {
  private workers: Worker<QueueJobData>[] = [];
  private deliveryTimer?: ReturnType<typeof setInterval>;
  private sweeping = false;

  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: ConnectionOptions,
    private readonly agents: TaxAgentService,
    private readonly sunatSend: SunatSendProcessor,
    private readonly sunatPoll: SunatPollProcessor,
    private readonly pdfRender: PdfRenderProcessor,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  onModuleInit(): void {
    this.workers.push(
      new Worker<QueueJobData>("tax-agent", async (job) => this.agents.process(job), {
        connection: this.connection,
        concurrency: 2,
      }),
      new Worker<QueueJobData>("document-delivery", async (job) => this.delivery.process(job), {
        connection: this.connection,
        concurrency: 2,
      }),
      new Worker<QueueJobData>("sunat-send", async (job) => this.sunatSend.process(job), {
        connection: this.connection,
        concurrency: 2,
      }),
      new Worker<QueueJobData>("sunat-poll", async (job) => this.sunatPoll.process(job), {
        connection: this.connection,
        concurrency: 2,
      }),
      new Worker<QueueJobData>("pdf-render", async (job) => this.pdfRender.process(job), {
        connection: this.connection,
        concurrency: 1,
      }),
    );
    const sweep = async () => {
      if (this.sweeping) return;
      this.sweeping = true;
      try {
        await Promise.allSettled([this.delivery.sweep(), this.agents.sweep()]);
      } catch {
        /* Durable outbox retries next sweep. */
      } finally {
        this.sweeping = false;
      }
    };
    this.deliveryTimer = setInterval(() => {
      void sweep();
    }, 30000);
    this.deliveryTimer.unref();
    void sweep();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.deliveryTimer) clearInterval(this.deliveryTimer);
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
