import {
  Global,
  Inject,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Queue, Worker, type ConnectionOptions } from "bullmq";

import type { Env } from "../config/env.schema";
import { processNoopJob } from "./noop.processors";
import { QueueProducer } from "./queue.producer";
import {
  BULLMQ_CONNECTION,
  BULLMQ_QUEUES,
  QUEUE_NAMES,
  type QueueJobData,
  type QueueName,
} from "./queue.tokens";

function redisUrlToConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    maxRetriesPerRequest: null,
  };
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): ConnectionOptions => {
        return redisUrlToConnection(config.get("REDIS_URL", { infer: true }));
      },
    },
    {
      provide: BULLMQ_QUEUES,
      inject: [BULLMQ_CONNECTION],
      useFactory: (connection: ConnectionOptions) => {
        const queues = {} as Record<QueueName, Queue<QueueJobData>>;
        for (const name of QUEUE_NAMES) {
          queues[name] = new Queue<QueueJobData>(name, { connection });
        }
        return queues;
      },
    },
    QueueProducer,
  ],
  exports: [BULLMQ_CONNECTION, BULLMQ_QUEUES, QueueProducer],
})
export class QueuesModule implements OnModuleInit, OnModuleDestroy {
  private workers: Worker<QueueJobData>[] = [];

  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: ConnectionOptions,
    @Inject(BULLMQ_QUEUES)
    private readonly queues: Record<QueueName, Queue<QueueJobData>>,
  ) {}

  onModuleInit(): void {
    // Real workers registered by DocumentsModule.
    for (const name of QUEUE_NAMES) {
      if (name === "sunat-send" || name === "sunat-poll") continue;
      const worker = new Worker<QueueJobData>(
        name,
        async (job) => processNoopJob(name, job),
        { connection: this.connection, concurrency: 1 },
      );
      this.workers.push(worker);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all(QUEUE_NAMES.map((n) => this.queues[n].close()));
  }
}
