import { Link, type LinkProps } from "react-router-dom";

import { cn, textLinkClassName } from "@factosys/ui";

const linkClass = textLinkClassName;

export function TextLink({ className, ...props }: LinkProps & { className?: string }) {
  return <Link className={cn(linkClass, className)} {...props} />;
}

export { TextAnchor } from "@factosys/ui";
