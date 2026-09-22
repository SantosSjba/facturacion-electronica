import type { DocumentEvent } from "../types";

function formatAt(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function DocumentTimeline({ events }: { events: DocumentEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Sin eventos.</p>
    );
  }

  return (
    <ol className="space-y-3 border-l border-[var(--border)] pl-4">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-sm font-medium">{e.status}</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {formatAt(e.at)} · {e.source}
            </span>
          </div>
          {e.detail ? (
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {e.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
