import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Clock,
  Layers,
  Mail,
  Settings2,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react";
import { toast } from "@factosys/ui";

import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/modules/app/api/notifications";
import { formatDateTime } from "@/shared/ui/display-labels";
import {
  ActionButton,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  IconTile,
  LoadingState,
  PageHeader,
  SectionCard,
  cn,
} from "@factosys/ui";

const EVENT_LABELS: Record<string, string> = {
  "plan.change_requested": "Cambio de plan",
  "plan.assigned": "Plan asignado",
  "invite.member": "Invitaciones",
  system: "Sistema",
};

function eventIcon(code: string): LucideIcon {
  if (code.startsWith("plan.")) return Layers;
  if (code.startsWith("invite.")) return UserPlus;
  if (code === "system") return Settings2;
  return Bell;
}

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
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Notificaciones"
        description="Centro de avisos in-app y preferencias de canal."
        actions={
          unread > 0 ? (
            <ActionButton
              icon={CheckCheck}
              label="Marcar todas leídas"
              pending={markAll.isPending}
              onClick={() => markAll.mutate()}
            />
          ) : null
        }
      />

      {inboxQuery.isLoading ? (
        <LoadingState variant="list" label="Cargando notificaciones…" />
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
          icon={BellOff}
          title="Sin notificaciones"
          description="Cuando haya avisos de plan, invites u otros eventos aparecerán aquí."
        />
      ) : null}

      <ul className="space-y-2">
        {items.map((n) => {
          const unreadItem = !n.read_at;
          return (
            <li key={n.id}>
              <Button
                variant="ghost"
                type="button"
                className={cn(
                  "h-auto w-full justify-start whitespace-normal rounded-2xl border px-4 py-3 text-start transition-colors",
                  unreadItem
                    ? "border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
                )}
                onClick={() => {
                  if (unreadItem) markOne.mutate(n.id);
                }}
              >
                <div className="flex w-full items-start gap-3">
                  <IconTile
                    icon={eventIcon(n.template_code)}
                    tone={unreadItem ? "brand" : "neutral"}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {n.title ?? n.template_code}
                    </p>
                    {n.body ? (
                      <p className="mt-1 text-sm font-normal text-gray-600 dark:text-gray-300">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-2 flex items-center gap-1 text-theme-xs font-normal text-gray-500">
                      <Clock className="size-3 shrink-0" aria-hidden />
                      {formatDateTime(n.created_at)}
                    </p>
                  </div>
                  {unreadItem ? (
                    <span
                      className="mt-1 size-2 shrink-0 rounded-full bg-brand-500"
                      aria-label="No leída"
                    />
                  ) : null}
                </div>
              </Button>
            </li>
          );
        })}
      </ul>

      <SectionCard
        icon={SlidersHorizontal}
        tone="neutral"
        title="Preferencias"
        description="Activa o desactiva email e in-app por tipo de evento."
      >
        {prefsQuery.isLoading ? (
          <LoadingState variant="form" fields={4} label="Cargando preferencias…" />
        ) : null}
        <div className="space-y-3">
          {prefs.map((p) => {
            const EventIcon = eventIcon(p.event_code);
            return (
              <div
                key={p.event_code}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
                  <EventIcon className="size-4 shrink-0 text-gray-400" aria-hidden />
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
                    <Mail className="size-3.5 shrink-0 text-gray-400" aria-hidden />
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
                    <BellRing className="size-3.5 shrink-0 text-gray-400" aria-hidden />
                    In-app
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
