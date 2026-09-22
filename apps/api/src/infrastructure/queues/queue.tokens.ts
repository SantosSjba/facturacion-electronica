export const QUEUE_NAMES = [
  "sunat-send",
  "sunat-poll",
  "webhooks",
  "pdf-render",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const BULLMQ_CONNECTION = Symbol("BULLMQ_CONNECTION");
export const BULLMQ_QUEUES = Symbol("BULLMQ_QUEUES");

/** Job payloads carry UUIDs only (doc 26 §7). */
export interface QueueJobData {
  organizationId: string;
  companyId: string;
  documentId?: string;
  deliveryId?: string;
}
