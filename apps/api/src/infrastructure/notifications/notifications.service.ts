import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { notificationDeliveries, type Db } from "@factosys/db";

import { DB } from "../persistence/db.tokens";

export interface NotificationDeliveryPublic {
  id: string;
  template_code: string;
  to_email: string;
  event_key: string;
  signup_request_id: string | null;
  status: string;
  attempt_count: number;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(filters: {
    status?: string;
    eventKey?: string;
    limit?: number;
  }): Promise<{ items: NotificationDeliveryPublic[] }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const conditions: SQL[] = [];
    if (filters.status) {
      conditions.push(eq(notificationDeliveries.status, filters.status));
    }
    if (filters.eventKey) {
      conditions.push(eq(notificationDeliveries.eventKey, filters.eventKey));
    }

    const rows = await this.db
      .select()
      .from(notificationDeliveries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(limit);

    return {
      items: rows.map((r) => ({
        id: r.id,
        template_code: r.templateCode,
        to_email: r.toEmail,
        event_key: r.eventKey,
        signup_request_id: r.signupRequestId,
        status: r.status,
        attempt_count: r.attemptCount,
        provider_message_id: r.providerMessageId,
        last_error: r.lastError,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
    };
  }
}
