import { cn } from "./cn";

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

interface ChartProps {
  data: ChartDatum[];
  label: string;
  onSelect?: (index: number) => void;
  className?: string;
}

const format = new Intl.NumberFormat("es-PE");
const percent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

/** Accessible counts stay readable without color, pointer interaction or SVG support. */
export function HorizontalBarChart({ data, label, onSelect, className }: ChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <ul aria-label={label} className={cn("space-y-5", className)}>
      {data.map((item, index) => {
        const content = (
          <>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
              <span className="flex items-baseline gap-2">
                <strong className="tabular-nums text-gray-900 dark:text-white/90">
                  {format.format(item.value)}
                </strong>
                <span className="w-10 text-end text-theme-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {percent(item.value, total)}%
                </span>
              </span>
            </div>
            <div
              aria-hidden
              className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
              />
            </div>
          </>
        );
        return (
          <li key={item.label}>
            {onSelect ? (
              <button
                type="button"
                className="block w-full rounded-lg text-start outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-brand-500/30"
                onClick={() => onSelect(index)}
                aria-label={`${item.label}: ${format.format(item.value)} (${percent(item.value, total)}%)`}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** SVG ring uses real proportions, with a neutral ring for an empty dataset. */
export function DonutChart({
  data,
  label,
  onSelect,
  className,
  totalLabel = "en total",
}: ChartProps & { totalLabel?: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 76;
  let offset = 0;
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <svg
        viewBox="0 0 200 200"
        className="size-56 max-w-full text-gray-900 dark:text-white/90"
        role="img"
        aria-label={`${label}: ${format.format(total)} ${totalLabel}`}
      >
        <circle
          cx="100"
          cy="100"
          r="76"
          fill="none"
          stroke="currentColor"
          strokeWidth="18"
          className="text-gray-100 dark:text-gray-800"
        />
        <g transform="rotate(-90 100 100)">
          {data.map((item) => {
            const length = total > 0 ? (item.value / total) * circumference : 0;
            const start = offset;
            offset += length;
            return length > 0 ? (
              <circle
                key={item.label}
                cx="100"
                cy="100"
                r="76"
                fill="none"
                stroke={item.color}
                strokeWidth="18"
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-start}
              />
            ) : null;
          })}
        </g>
        <text x="100" y="100" textAnchor="middle" className="fill-current text-3xl font-semibold">
          {format.format(total)}
        </text>
        <text
          x="100"
          y="123"
          textAnchor="middle"
          className="fill-current text-xs text-gray-500 dark:text-gray-400"
        >
          {totalLabel}
        </text>
      </svg>
      <ul aria-label={`Detalle de ${label.toLowerCase()}`} className="w-full space-y-3">
        {data.map((item, index) => {
          const content = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <strong className="text-gray-900 dark:text-white/90">
                  {format.format(item.value)}
                </strong>
                <span className="w-10 text-end text-theme-xs text-gray-500 dark:text-gray-400">
                  {percent(item.value, total)}%
                </span>
              </span>
            </>
          );
          return (
            <li key={item.label}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg text-sm text-gray-600 outline-none hover:text-brand-500 focus-visible:ring-3 focus-visible:ring-brand-500/30 dark:text-gray-300"
                  aria-label={`${item.label}: ${format.format(item.value)} (${percent(item.value, total)}%)`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
