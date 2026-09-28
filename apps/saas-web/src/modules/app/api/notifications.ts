import { apiRequest } from "@/shared/api/http-client";

export interface InAppNotification {
  id: string;
  template_code: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  event_code: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

export function fetchNotifications(): Promise<{
  items: InAppNotification[];
  unread_count: number;
}> {
  return apiRequest("/organizations/me/notifications");
}

export function markNotificationRead(
  id: string,
): Promise<InAppNotification> {
  return apiRequest(`/organizations/me/notifications/${id}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiRequest("/organizations/me/notifications/read-all", {
    method: "POST",
  });
}

export function fetchNotificationPreferences(): Promise<{
  items: NotificationPreference[];
}> {
  return apiRequest("/organizations/me/notification-preferences");
}

export function updateNotificationPreferences(
  items: Array<{
    event_code: string;
    email_enabled?: boolean;
    in_app_enabled?: boolean;
  }>,
): Promise<{ items: NotificationPreference[] }> {
  return apiRequest("/organizations/me/notification-preferences", {
    method: "PATCH",
    body: { items },
  });
}
