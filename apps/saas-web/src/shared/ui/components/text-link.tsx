import { Link, type LinkProps } from "react-router-dom";

import { cn } from "../utils";

const linkClass =
  "font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300";

export function TextLink({
  className,
  ...props
}: LinkProps & { className?: string }) {
  return <Link className={cn(linkClass, className)} {...props} />;
}

export function TextAnchor({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cn(linkClass, className)} {...props} />;
}
