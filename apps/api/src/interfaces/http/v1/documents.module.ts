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
import { CredentialsResolver } from "../../../infrastructure/documents/credentials-resolver";
import { DocumentsService } from "../../../infrastructure/documents/documents.service";
import { IdempotencyModule } from "../../../infrastructure/idempotency/idempotency.module";
import {
  BULLMQ_CONNECTION,
  type QueueJobData,
} from "../../../infrastructure/queues/queue.tokens";
import { SunatSendProcessor } from "../../../infrastructure/queues/sunat-send.processor";
import { CompaniesModule } from "../companies/companies.module";
import { DocumentsController } from "./documents.controller";
import { InvoicesController } from "./invoices.controller";
import {
  CreditNotesController,
  DebitNotesController,
} from "./notes.controller";
import { ReceiptsController } from "./receipts.controller";

@Module({
  imports: [CompaniesModule, IdempotencyModule],
  controllers: [
    InvoicesController,
    ReceiptsController,
    CreditNotesController,
    DebitNotesController,
    DocumentsController,
  ],
  providers: [
    DocumentsService,
    CredentialsResolver,
    EmitDocumentOrchestrator,
    EmitInvoiceUseCase,
    EmitReceiptUseCase,
    EmitCreditNoteUseCase,
    EmitDebitNoteUseCase,
    SunatSendProcessor,
  ],
  exports: [
    DocumentsService,
    EmitInvoiceUseCase,
    EmitReceiptUseCase,
    EmitCreditNoteUseCase,
    EmitDebitNoteUseCase,
  ],
})
export class DocumentsModule implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<QueueJobData> | undefined;

  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: ConnectionOptions,
    private readonly sunatSend: SunatSendProcessor,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<QueueJobData>(
      "sunat-send",
      async (job) => this.sunatSend.process(job),
      { connection: this.connection, concurrency: 2 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
