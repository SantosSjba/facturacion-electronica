import type { HTMLAttributes, ImgHTMLAttributes, IframeHTMLAttributes } from "react";
import { cn } from "./cn";

export function ResponsiveImage({
  className,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  return (
    <img
      {...props}
      alt={alt}
      className={cn(
        "w-full rounded-xl border border-gray-200 object-cover dark:border-gray-800",
        className,
      )}
    />
  );
}
export function ImageGrid({
  columns = 2,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { columns?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:gap-6",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}
export function TwoColumnImageGrid(props: HTMLAttributes<HTMLDivElement>) {
  return <ImageGrid {...props} columns={2} />;
}
export function ThreeColumnImageGrid(props: HTMLAttributes<HTMLDivElement>) {
  return <ImageGrid {...props} columns={3} />;
}
export interface AspectRatioVideoProps extends Omit<
  IframeHTMLAttributes<HTMLIFrameElement>,
  "src"
> {
  videoUrl: string;
  title: string;
  aspectRatio?: "16/9" | "21/9" | "4/3" | "1/1";
  containerClassName?: string;
}
const ratios = {
  "16/9": "aspect-video",
  "21/9": "aspect-[21/9]",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
};
export function AspectRatioVideo({
  videoUrl,
  title,
  aspectRatio = "16/9",
  containerClassName,
  className,
  ...props
}: AspectRatioVideoProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg", ratios[aspectRatio], containerClassName)}>
      <iframe
        {...props}
        src={videoUrl}
        title={title}
        allowFullScreen
        className={cn("size-full border-0", className)}
      />
    </div>
  );
}
export function SixteenIsToNine(props: AspectRatioVideoProps) {
  return <AspectRatioVideo {...props} aspectRatio="16/9" />;
}
export function TwentyOneIsToNine(props: AspectRatioVideoProps) {
  return <AspectRatioVideo {...props} aspectRatio="21/9" />;
}
export function FourIsToThree(props: AspectRatioVideoProps) {
  return <AspectRatioVideo {...props} aspectRatio="4/3" />;
}
export function OneIsToOne(props: AspectRatioVideoProps) {
  return <AspectRatioVideo {...props} aspectRatio="1/1" />;
}
