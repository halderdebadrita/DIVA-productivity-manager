import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./button";

/** Consistent external link button (always new tab, noopener). */
export function ExternalButton({
  href, children, className, variant = "secondary", size = "sm", icon = true,
}: { href: string; children: React.ReactNode; className?: string; icon?: boolean } & VariantProps<typeof buttonVariants>) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant, size }), className)}>
      {children}
      {icon && <ExternalLink className="opacity-60" aria-hidden />}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function LinkButton({
  href, children, className, variant = "secondary", size = "sm",
}: { href: string; children: React.ReactNode; className?: string } & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
