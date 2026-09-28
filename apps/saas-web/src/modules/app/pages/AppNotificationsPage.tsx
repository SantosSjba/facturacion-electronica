import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";

import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/modules/app/api/notifications";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { cn } from "@/shared/ui/utils";

const EVENT_LABELS: Record<string, string> = {
  "plan.change_requested": "Cambio de plan",
  "plan.assigned": "Plan asignado",
  "invite.member": "Invitaciones",
  system: "Sistema",
};

export function AppNotificationsPage() {
  const queryClient = useQueryClient();

  const inboxQuery = useQuery({
    queryKey: ["org-notifications"],
    queryFn: fetchNotifications,
  });
  const prefsQuery = useQuery({
    queryKey: ["org-notification-prefs"],
    queryFn: fetchNotificationPreferences,
  });

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["org-notifications"] });
    },
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      toast.success("Todas marcadas como leídas");
      void queryClient.invalidateQueries({ queryKey: ["org-notifications"] });
    },
  });
  const prefsMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      void queryClient.invalidateQueries({
        queryKey: ["org-notification-prefs"],
      });
    },
  });

  const items = inboxQuery.data?.items ?? [];
  const unread = inboxQuery.data?.unread_count ?? 0;
  const prefs = prefsQuery.data?.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notificaciones"
        description="Centro de avisos in-app y preferencias de canal."
        actions={
          unread > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className={buttonIconClassName} />
              <ButtonLabel>Marcar todas leídas</ButtonLabel>
            </Button>
          ) : null
        }
      />

      {inboxQuery.isLoading ? (
        <LoadingState label="Cargando notificaciones…" />
      ) : null}
      {inboxQuery.error ? (
        <ErrorState
          message={
            inboxQuery.error instanceof Error
              ? inboxQuery.error.message
              : "Error al cargar notificaciones"
          }
        />
      ) : null}

      {!inboxQuery.isLoading && !inboxQuery.error && items.length === 0 ? (
        <EmptyState
          title="Sin notificaciones"
          description="Cuando haya avisos de plan, invites u otros eventos aparecerán aquí."
        />
      ) : null}

      <ul className="space-y-2">
        {items.map((n) => {
          const unreadItem = !n.read_at;
          return (
            <li key={n.id}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-start transition-colors",
                  unreadItem
                    ? "border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
                )}
                onClick={() => {
                  if (unreadItem) markOne.mutate(n.id);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {n.title ?? n.template_code}
                    </p>
                    {n.body ? (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-2 text-theme-xs text-gray-500">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {unreadItem ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-500" />
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Card className="space-y-4">
        <CardTitle>Preferencias</CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Activa o desactiva email e in-app por tipo de evento.
        </p>
        {prefsQuery.isLoading ? (
          <LoadingState label="Cargando preferencias…" />
        ) : null}
        <div className="space-y-3">
          {prefs.map((p) => (
            <div
              key={p.event_code}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800"
            >
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {EVENT_LABELS[p.event_code] ?? p.event_code}
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Checkbox
                    checked={p.email_enabled}
                    onChange={(e) => {
                      prefsMutation.mutate([
                        {
                          event_code: p.event_code,
                          email_enabled: e.target.checked,
                          in_app_enabled: p.in_app_enabled,
                        },
                      ]);
                    }}
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Checkbox
                    checked={p.in_app_enabled}
                    onChange={(e) => {
                      prefsMutation.mutate([
                        {
                          event_code: p.event_code,
                          email_enabled: p.email_enabled,
                          in_app_enabled: e.target.checked,
                        },
                      ]);
                    }}
                  />
                  In-app
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
