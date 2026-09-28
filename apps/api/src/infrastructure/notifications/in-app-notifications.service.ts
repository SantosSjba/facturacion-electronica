import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  newId,
  notificationPreferences,
  notifications,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";

export const NOTIFICATION_EVENT_CODES = [
  "plan.change_requested",
  "plan.assigned",
  "invite.member",
  "system",
] as const;

export type NotificationEventCode = (typeof NOTIFICATION_EVENT_CODES)[number];

export interface InAppNotificationPublic {
  id: string;
  template_code: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferencePublic {
  event_code: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

@Injectable()
export class InAppNotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async createForUser(input: {
    organizationId: string;
    userId: string;
    eventCode: NotificationEventCode | string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const prefs = await this.getPreference(input.userId, input.eventCode);
    if (!prefs.inAppEnabled) {
      return;
    }

    await this.db.insert(notifications).values({
      id: newId(),
      organizationId: input.organizationId,
      userId: input.userId,
      templateCode: input.eventCode,
      title: input.title,
      body: input.body,
      payload: input.payload ?? {},
      status: "sent",
      sentAt: new Date(),
      readAt: null,
    });
  }

  async listForUser(
    userId: string,
    organizationId: string,
  ): Promise<{ items: InAppNotificationPublic[]; unread_count: number }> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.organizationId, organizationId),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(100);

    const unreadRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.organizationId, organizationId),
          isNull(notifications.readAt),
        ),
      );

    return {
      items: rows.map((r) => ({
        id: r.id,
        template_code: r.templateCode,
        title: r.title,
        body: r.body,
        payload: r.payload ?? {},
        read_at: r.readAt?.toISOString() ?? null,
        created_at: r.createdAt.toISOString(),
      })),
      unread_count: Number(unreadRows[0]?.count ?? 0),
    };
  }

  async markRead(
    userId: string,
    organizationId: string,
    notificationId: string,
  ): Promise<InAppNotificationPublic> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
          eq(notifications.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Notification not found");
    }
    if (!row.readAt) {
      await this.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(eq(notifications.id, notificationId));
      row.readAt = new Date();
    }
    return {
      id: row.id,
      template_code: row.templateCode,
      title: row.title,
      body: row.body,
      payload: row.payload ?? {},
      read_at: row.readAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    };
  }

  async markAllRead(userId: string, organizationId: string): Promise<{ updated: number }> {
    const unreadRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.organizationId, organizationId),
          isNull(notifications.readAt),
        ),
      );
    const updated = Number(unreadRows[0]?.count ?? 0);
    if (updated > 0) {
      await this.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.organizationId, organizationId),
            isNull(notifications.readAt),
          ),
        );
    }
    return { updated };
  }

  async listPreferences(userId: string): Promise<{ items: NotificationPreferencePublic[] }> {
    const existing = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    const byCode = new Map(existing.map((r) => [r.eventCode, r]));

    const items: NotificationPreferencePublic[] = NOTIFICATION_EVENT_CODES.map(
      (code) => {
        const row = byCode.get(code);
        return {
          event_code: code,
          email_enabled: row?.emailEnabled ?? true,
          in_app_enabled: row?.inAppEnabled ?? true,
        };
      },
    );
    return { items };
  }

  async updatePreferences(
    userId: string,
    updates: Array<{
      eventCode: string;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
    }>,
  ): Promise<{ items: NotificationPreferencePublic[] }> {
    for (const u of updates) {
      if (
        !NOTIFICATION_EVENT_CODES.includes(
          u.eventCode as NotificationEventCode,
        )
      ) {
        throw AppError.validation(`Unknown event_code: ${u.eventCode}`);
      }
      const existing = await this.db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.eventCode, u.eventCode),
          ),
        )
        .limit(1);
      const now = new Date();
      if (existing[0]) {
        await this.db
          .update(notificationPreferences)
          .set({
            emailEnabled: u.emailEnabled ?? existing[0].emailEnabled,
            inAppEnabled: u.inAppEnabled ?? existing[0].inAppEnabled,
            updatedAt: now,
          })
          .where(eq(notificationPreferences.id, existing[0].id));
      } else {
        await this.db.insert(notificationPreferences).values({
          id: newId(),
          userId,
          eventCode: u.eventCode,
          emailEnabled: u.emailEnabled ?? true,
          inAppEnabled: u.inAppEnabled ?? true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return this.listPreferences(userId);
  }

  async isEmailEnabled(userId: string, eventCode: string): Promise<boolean> {
    const prefs = await this.getPreference(userId, eventCode);
    return prefs.emailEnabled;
  }

  private async getPreference(
    userId: string,
    eventCode: string,
  ): Promise<{ emailEnabled: boolean; inAppEnabled: boolean }> {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.eventCode, eventCode),
        ),
      )
      .limit(1);
    const row = rows[0];
    return {
      emailEnabled: row?.emailEnabled ?? true,
      inAppEnabled: row?.inAppEnabled ?? true,
    };
  }
}
