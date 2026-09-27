import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Send,
  XCircle,
} from "lucide-react";

import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

import type { DocumentEvent } from "../types";
import { formatDocDate } from "../doc-labels";

function eventVisual(status: string): {
  Icon: typeof CheckCircle2;
  dot: string;
  iconWrap: string;
} {
  if (status === "accepted" || status === "validated") {
    return {
      Icon: CheckCircle2,
      dot: "bg-success-500",
      iconWrap:
        "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
    };
  }
  if (status === "accepted_with_observation") {
    return {
      Icon: AlertTriangle,
      dot: "bg-warning-500",
      iconWrap:
        "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
    };
  }
  if (
    status === "rejected" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return {
      Icon: status === "cancelled" ? Ban : XCircle,
      dot: "bg-error-500",
      iconWrap:
        "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
    };
  }
  if (status === "sent" || status === "queued" || status === "ticket_pending") {
    return {
      Icon: status === "sent" ? Send : Clock3,
      dot: "bg-brand-500",
      iconWrap:
        "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
    };
  }
  return {
    Icon: CircleDashed,
    dot: "bg-gray-400",
    iconWrap:
      "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  };
}

export function DocumentTimeline({ events }: { events: DocumentEvent[] }) {
  if (events.length === 0) {
    return <MutedText>Sin eventos registrados.</MutedText>;
  }

  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const { Icon, iconWrap } = eventVisual(e.status);
        const isLast = i === events.length - 1;
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span
                className="absolute start-[1.15rem] top-10 bottom-0 w-px bg-gray-200 dark:bg-gray-800"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full",
                iconWrap,
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  {e.status}
                </span>
                <MutedText as="span" className="text-theme-xs">
                  {formatDocDate(e.at)}
                </MutedText>
              </div>
              <MutedText as="span" className="mt-0.5 block text-theme-xs">
                Origen: {e.source}
                {e.from_status ? ` · desde ${e.from_status}` : ""}
              </MutedText>
              {e.detail ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {e.detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
