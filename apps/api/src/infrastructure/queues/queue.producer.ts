import { Inject, Injectable } from "@nestjs/common";
import type { JobsOptions, Queue } from "bullmq";

import {
  BULLMQ_QUEUES,
  type QueueJobData,
  type QueueName,
} from "./queue.tokens";

@Injectable()
export class QueueProducer {
  constructor(
    @Inject(BULLMQ_QUEUES)
    private readonly queues: Record<QueueName, Queue<QueueJobData>>,
  ) {}

  async enqueue(
    name: QueueName,
    data: QueueJobData,
    opts?: JobsOptions,
  ): Promise<{ jobId: string }> {
    const queue = this.queues[name];
    const job = await queue.add(name, data, {
      removeOnComplete: 100,
      removeOnFail: 50,
      ...opts,
    });
    if (!job.id) {
      throw new Error(`Failed to enqueue job on ${name}`);
    }
    return { jobId: job.id };
  }

  getQueue(name: QueueName): Queue<QueueJobData> {
    return this.queues[name];
  }
}
