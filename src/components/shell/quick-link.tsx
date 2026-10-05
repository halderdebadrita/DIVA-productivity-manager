"use client";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { QUICK_LINK_DEFS } from "@/lib/quick-links";
import { useApp } from "./app-provider";

export const defFor = (key: string) => QUICK_LINK_DEFS.find((d) => d.key === key)!;

export function LinkMark({ k, className }: { k: string; className?: string }) {
  const d = defFor(k);
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white", className)} style={{ background: d.color }} aria-hidden>
      {d.mark}
    </span>
  );
}

/** Compact button that opens one of your quick links in a new tab (hidden if you cleared it). */
export function QuickLinkButton({ k, label, variant = "secondary" }: { k: string; label?: string; variant?: "secondary" | "primary" }) {
  const { links } = useApp();
  const url = links[k];
  if (!url) return null;
  const d = defFor(k);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
        variant === "primary" ? "bg-accent text-accent-fg hover:bg-accent/90" : "border border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3",
      )}
    >
      <LinkMark k={k} className="size-5 text-[9px]" />
      {label ?? d.label}
      <ArrowUpRight className="size-3.5 opacity-60" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** Larger row used in panels. */
export function QuickLinkRow({ k, blurb }: { k: string; blurb: string }) {
  const { links } = useApp();
  const url = links[k];
  if (!url) return null;
  const d = defFor(k);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-border-strong">
      <LinkMark k={k} className="size-8 text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Open {d.label}</span>
        <span className="block truncate text-2xs text-subtle">{blurb}</span>
      </span>
      <ArrowUpRight className="size-4 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
