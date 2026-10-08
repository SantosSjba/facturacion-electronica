import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** Visual placeholder only: the region announces loading once. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn("rounded-md bg-gray-200 motion-safe:animate-pulse dark:bg-gray-800", className)}
    />
  );
}
export type SkeletonVariant =
  "table" | "cards" | "detail" | "form" | "list" | "documents" | "dashboard" | "page";
export interface SkeletonProps {
  label?: string;
  className?: string;
  rows?: number;
  columns?: number;
  fields?: number;
  count?: number;
  showHeader?: boolean;
  contained?: boolean;
}
function count(value: number | undefined, fallback: number, max = 12) {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.floor(value)))
    : fallback;
}
const surface =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6";
function TextShape() {
  return (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
function HeaderShape() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="w-2/3 space-y-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
  );
}
function CardShape() {
  return (
    <div className={cn(surface, "space-y-4")}>
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
function TableShape({ rows, columns }: SkeletonProps) {
  const rowCount = count(rows, 5),
    columnCount = count(columns, 5, 8);
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] md:block">
        <div
          className="grid gap-5 border-b border-gray-100 px-5 py-4 dark:border-gray-800"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columnCount }, (_, index) => (
            <Skeleton key={index} className="h-3 w-2/3" />
          ))}
        </div>
        {Array.from({ length: rowCount }, (_, row) => (
          <div
            key={row}
            className="grid gap-5 border-b border-gray-100 px-5 py-5 last:border-0 dark:border-gray-800"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columnCount }, (_, col) => (
              <Skeleton
                key={col}
                className={cn(
                  "h-4",
                  col === columnCount - 1 ? "w-1/2" : row % 2 ? "w-3/4" : "w-full",
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-4 md:hidden">
        {Array.from({ length: rowCount }, (_, row) => (
          <div key={row} className={cn(surface, "space-y-3")}>
            {Array.from({ length: columnCount }, (_, col) => (
              <div key={col} className="flex justify-between gap-4">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
    </>
  );
}
function FormShape({ fields, contained = false }: SkeletonProps) {
  return (
    <div className={cn("space-y-5", contained && surface)}>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: count(fields, 6) }, (_, index) => (
          <div key={index} className={cn("space-y-2", index < 2 && "sm:col-span-2")}>
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
function DetailShape({ fields, showHeader = true, contained = true }: SkeletonProps) {
  return (
    <div className="space-y-6">
      {showHeader && (
        <>
          <HeaderShape />
          <div className="flex gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-1/5 max-w-24" />
            ))}
          </div>
        </>
      )}
      <div className={cn("space-y-6", contained && surface)}>
        <TextShape />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: count(fields, 6) }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function ListShape({ rows, contained = true }: SkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count(rows, 4) }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex gap-4",
            contained ? surface : "border-b border-gray-100 p-3 dark:border-gray-800",
          )}
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <TextShape />
          </div>
        </div>
      ))}
    </div>
  );
}
function DocumentsShape({ count: blocks, contained = true }: SkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count(blocks, 2, 6) }, (_, index) => (
        <div key={index} className={cn("space-y-4", contained && surface)}>
          <Skeleton className="h-5 w-1/2" />
          <TextShape />
          <TextShape />
        </div>
      ))}
    </div>
  );
}
export function SkeletonRegion({
  label = "Cargando…",
  className,
  children,
  variant,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
  variant?: SkeletonVariant;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-skeleton={variant ?? "custom"}
      className={className}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
export function SkeletonContent({
  variant,
  ...props
}: SkeletonProps & { variant: SkeletonVariant }) {
  if (variant === "table") return <TableShape {...props} />;
  if (variant === "form") return <FormShape {...props} />;
  if (variant === "detail") return <DetailShape {...props} />;
  if (variant === "list") return <ListShape {...props} />;
  if (variant === "documents") return <DocumentsShape {...props} />;
  if (variant === "page")
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <HeaderShape />
        <DetailShape fields={4} showHeader={false} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: count(props.count, 3) }, (_, index) => (
            <CardShape key={index} />
          ))}
        </div>
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count(props.count, variant === "dashboard" ? 8 : 3) }, (_, index) => (
        <CardShape key={index} />
      ))}
    </div>
  );
}
function Scenario({
  variant,
  label,
  className,
  ...props
}: SkeletonProps & { variant: SkeletonVariant }) {
  return (
    <SkeletonRegion variant={variant} label={label} className={className}>
      <SkeletonContent variant={variant} {...props} />
    </SkeletonRegion>
  );
}
export function TableSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="table" />;
}
export function FormSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="form" />;
}
export function DetailSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="detail" />;
}
export function CardsSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="cards" />;
}
export function ListSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="list" />;
}
export function DocumentsSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="documents" />;
}
export function DashboardSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="dashboard" />;
}
export function PageSkeleton(props: SkeletonProps) {
  return <Scenario {...props} variant="page" />;
}
