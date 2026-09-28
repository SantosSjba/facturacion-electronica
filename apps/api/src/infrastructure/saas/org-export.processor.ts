import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";

import type { QueueJobData } from "../queues/queue.tokens";
import { OrgExportService } from "./org-export.service";

@Injectable()
export class OrgExportProcessor {
  constructor(private readonly exports: OrgExportService) {}

  async process(job: Job<QueueJobData>): Promise<{ ok: true }> {
    const { exportId, organizationId } = job.data;
    if (!exportId) {
      throw new Error("org-export job missing exportId");
    }
    await this.exports.processExportJob(exportId, organizationId);
    return { ok: true };
  }
}
