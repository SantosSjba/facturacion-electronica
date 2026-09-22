import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { QueueJobData } from "../queues/queue.tokens";
import { PdfService } from "./pdf.service";

@Injectable()
export class PdfRenderProcessor {
  private readonly logger = new Logger(PdfRenderProcessor.name);

  constructor(private readonly pdf: PdfService) {}

  async process(job: Job<QueueJobData>): Promise<{ ok: true }> {
    const { organizationId, documentId } = job.data;
    if (!documentId) {
      throw new Error("pdf-render job missing documentId");
    }
    try {
      this.logger.log(`Rendering PDF for ${documentId}`);
      await this.pdf.renderAndStore(organizationId, documentId);
    } catch (cause) {
      this.logger.warn(
        `pdf-render skipped for ${documentId}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
    return { ok: true };
  }
}
