import { cn } from "./cn";
import {
  PageSkeleton,
  SkeletonContent,
  SkeletonRegion,
  type SkeletonProps,
  type SkeletonVariant,
} from "./skeleton";
import { Spinner } from "./spinner";
export interface LoadingStateProps extends SkeletonProps {
  variant?: SkeletonVariant | "inline";
}
export function LoadingState({
  label = "Cargando…",
  className,
  variant = "detail",
  ...props
}: LoadingStateProps) {
  if (variant === "inline")
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn(
          "flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400",
          className,
        )}
      >
        <Spinner className="size-4 text-brand-500" />
        <span>{label}</span>
      </div>
    );
  return (
    <SkeletonRegion label={label} className={className} variant={variant}>
      <SkeletonContent variant={variant} {...props} />
    </SkeletonRegion>
  );
}
/** Compatibility alias: session/route loading now reserves the page layout. */
export function PageSpinner(props: SkeletonProps) {
  return <PageSkeleton {...props} />;
}
