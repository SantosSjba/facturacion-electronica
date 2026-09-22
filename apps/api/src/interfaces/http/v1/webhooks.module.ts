import {
  Inject,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Worker, type ConnectionOptions } from "bullmq";

import {
  BULLMQ_CONNECTION,
  type QueueJobData,
} from "../../../infrastructure/queues/queue.tokens";
import { WebhookDeliveryProcessor } from "../../../infrastructure/webhooks/webhook-delivery.processor";
import { WebhookFanoutService } from "../../../infrastructure/webhooks/webhook-fanout.service";
import { WebhooksService } from "../../../infrastructure/webhooks/webhooks.service";
import { CompaniesModule } from "../companies/companies.module";
import { WebhookEndpointsController } from "./webhook-endpoints.controller";

@Module({
  imports: [CompaniesModule],
  controllers: [WebhookEndpointsController],
  providers: [
    WebhooksService,
    WebhookFanoutService,
    WebhookDeliveryProcessor,
  ],
  exports: [WebhooksService, WebhookFanoutService],
})
export class WebhooksModule implements OnModuleInit, OnModuleDestroy {
  private workers: Worker<QueueJobData>[] = [];

  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: ConnectionOptions,
    private readonly delivery: WebhookDeliveryProcessor,
  ) {}

  onModuleInit(): void {
    this.workers.push(
      new Worker<QueueJobData>(
        "webhooks",
        async (job) => this.delivery.process(job),
        { connection: this.connection, concurrency: 4 },
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
