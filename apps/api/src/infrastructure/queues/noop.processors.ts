import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { QueueJobData, QueueName } from "./queue.tokens";

const logger = new Logger("NoopQueueWorker");

/**
 * No-op processors for S3-INFRA — real SUNAT/PDF/webhook work lands in S4+.
 */
export async function processNoopJob(
  queueName: QueueName,
  job: Job<QueueJobData>,
): Promise<{ ok: true; queue: QueueName }> {
  const msg = `noop ${queueName} job=${job.id} org=${job.data.organizationId}`;
  logger.debug(msg);
  await job.log(msg);
  return { ok: true, queue: queueName };
}

@Injectable()
export class NoopProcessors {
  // Marker provider so Nest can inject QueuesModule without empty providers gap.
}
