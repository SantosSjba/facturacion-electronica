import {
  Inject,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Worker } from "bullmq";

import { EmitInvoiceUseCase } from "../../../infrastructure/documents/emit-invoice.use-case";
import { CredentialsResolver } from "../../../infrastructure/documents/credentials-resolver";
import { DocumentsService } from "../../../infrastructure/documents/documents.service";
import { IdempotencyModule } from "../../../infrastructure/idempotency/idempotency.module";
import {
  BULLMQ_CONNECTION,
  type QueueJobData,
} from "../../../infrastructure/queues/queue.tokens";
import { SunatSendProcessor } from "../../../infrastructure/queues/sunat-send.processor";
import type { ConnectionOptions } from "bullmq";
import { CompaniesModule } from "../companies/companies.module";
import { DocumentsController } from "./documents.controller";
import { InvoicesController } from "./invoices.controller";

@Module({
  imports: [CompaniesModule, IdempotencyModule],
  controllers: [InvoicesController, DocumentsController],
  providers: [
    DocumentsService,
    CredentialsResolver,
    EmitInvoiceUseCase,
    SunatSendProcessor,
  ],
  exports: [DocumentsService, EmitInvoiceUseCase],
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
