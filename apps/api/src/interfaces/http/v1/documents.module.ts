import {
  Inject,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
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
import {
  BULLMQ_CONNECTION,
  type QueueJobData,
} from "../../../infrastructure/queues/queue.tokens";
import { SunatSendProcessor } from "../../../infrastructure/queues/sunat-send.processor";
import { SunatPollProcessor } from "../../../infrastructure/queues/sunat-poll.processor";
import { CompaniesModule } from "../companies/companies.module";
import { DocumentsController } from "./documents.controller";
import { InvoicesController } from "./invoices.controller";
import {
  CreditNotesController,
  DebitNotesController,
} from "./notes.controller";
import { ReceiptsController } from "./receipts.controller";
import { VoidedDocumentsController } from "./voided-documents.controller";
import { DailySummariesController } from "./daily-summaries.controller";
import { DespatchAdvicesController } from "./despatch-advices.controller";

@Module({
  imports: [CompaniesModule, IdempotencyModule],
  controllers: [
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
  ],
  exports: [
    DocumentsService,
    EmitInvoiceUseCase,
    EmitReceiptUseCase,
    EmitCreditNoteUseCase,
    EmitDebitNoteUseCase,
    EmitVoidedDocumentUseCase,
    EmitDailySummaryUseCase,
    EmitDespatchAdviceUseCase,
  ],
})
export class DocumentsModule implements OnModuleInit, OnModuleDestroy {
  private workers: Worker<QueueJobData>[] = [];

  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: ConnectionOptions,
    private readonly sunatSend: SunatSendProcessor,
    private readonly sunatPoll: SunatPollProcessor,
  ) {}

  onModuleInit(): void {
    this.workers.push(
      new Worker<QueueJobData>(
        "sunat-send",
        async (job) => this.sunatSend.process(job),
        { connection: this.connection, concurrency: 2 },
      ),
      new Worker<QueueJobData>(
        "sunat-poll",
        async (job) => this.sunatPoll.process(job),
        { connection: this.connection, concurrency: 2 },
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
