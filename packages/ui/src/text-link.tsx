import type { AnchorHTMLAttributes } from "react";
import { cn } from "./cn";
import type { AdminLinkComponent } from "./admin/types";
export const textLinkClassName =
  "font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300";
export function TextAnchor({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={cn(textLinkClassName, className)} />;
}
export function TextLink({
  href,
  LinkComponent = "a",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; LinkComponent?: AdminLinkComponent }) {
  return <LinkComponent {...props} href={href} className={cn(textLinkClassName, className)} />;
}
