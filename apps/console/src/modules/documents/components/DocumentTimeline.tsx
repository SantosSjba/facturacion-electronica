import type { DocumentEvent } from "../types";
import { MutedText } from "@/shared/ui/components/muted-text";

function formatAt(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function DocumentTimeline({ events }: { events: DocumentEvent[] }) {
  if (events.length === 0) {
    return <MutedText>Sin eventos.</MutedText>;
  }

  return (
    <ol className="space-y-3 border-l border-gray-200 pl-4 dark:border-gray-800">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-sm font-medium">{e.status}</span>
            <MutedText as="span" className="text-xs">
              {formatAt(e.at)} · {e.source}
            </MutedText>
          </div>
          {e.detail ? <MutedText className="mt-0.5">{e.detail}</MutedText> : null}
        </li>
      ))}
    </ol>
  );
}
