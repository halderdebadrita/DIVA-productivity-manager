"use client";
import * as T from "@radix-ui/react-tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

/** Tabs whose active value is mirrored to ?tab= so links can deep-link into a section. */
export function UrlTabs({ tabs, defaultValue, children }: { tabs: { value: string; label: string; icon?: React.ReactNode }[]; defaultValue: string; children: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get("tab") && tabs.some((t) => t.value === params.get("tab")) ? params.get("tab")! : defaultValue;
  return (
    <T.Root
      value={value}
      onValueChange={(v) => {
        const p = new URLSearchParams(params);
        p.set("tab", v);
        router.replace(`${pathname}?${p}`, { scroll: false });
      }}
    >
      <T.List className="mb-4 flex gap-1 overflow-x-auto border-b border-border" aria-label="Sections">
        {tabs.map((t) => (
          <T.Trigger
            key={t.value}
            value={t.value}
            className={cn("relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-1 text-[13px] text-muted transition-colors hover:text-fg data-[state=active]:text-fg",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full data-[state=active]:after:bg-accent")}
          >
            {t.icon && <span className="[&_svg]:size-3.5">{t.icon}</span>}{t.label}
          </T.Trigger>
        ))}
      </T.List>
      {children}
    </T.Root>
  );
}
export const TabPanel = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => (
  <T.Content value={value} className={cn("focus-visible:outline-none", className)}>{children}</T.Content>
);
