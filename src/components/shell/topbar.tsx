"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import * as P from "@radix-ui/react-popover";
import { Bell, LayoutGrid, Menu, Plus, Search, X } from "lucide-react";
import { QUICK_LINK_DEFS } from "@/lib/quick-links";
import { LinkMark } from "./quick-link";
import { Button } from "@/components/ui/button";
import { CategoryDot } from "@/components/ui/bits";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { PanelItem } from "@/lib/services/reminders";
import { NAV, SETTINGS } from "./nav";
import { AccountBlock, NavLinks, isActive } from "./sidebar";
import { DivaMark } from "./logo";
import { SearchPalette } from "./search-palette";
import { useApp } from "./app-provider";

export function Topbar({ reminders }: { reminders: PanelItem[] }) {
  const pathname = usePathname();
  const app = useApp();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const section = [...NAV, SETTINGS].find((n) => isActive(pathname, n.href));
  const urgent = reminders.filter((r) => r.bucket === "overdue" || r.bucket === "today");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        {/* Mobile navigation */}
        <D.Root open={menu} onOpenChange={setMenu}>
          <D.Trigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button>
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-50 bg-black/60 lg:hidden" />
            <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border bg-surface px-3 py-4 lg:hidden" aria-describedby={undefined}>
              <D.Title className="sr-only">Navigation</D.Title>
              <div className="mb-6 flex items-center justify-between px-1.5">
                <div className="flex items-center gap-2.5"><DivaMark /><span className="font-semibold">Diva</span></div>
                <D.Close className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Close navigation"><X className="size-4" /></D.Close>
              </div>
              <nav className="flex-1"><NavLinks onNavigate={() => setMenu(false)} /></nav>
              <AccountBlock onNavigate={() => setMenu(false)} />
            </D.Content>
          </D.Portal>
        </D.Root>
        <Link href="/dashboard" className="lg:hidden" aria-label="Diva home"><DivaMark className="size-6" /></Link>

        <div className="hidden min-w-0 items-center gap-2 text-sm text-muted lg:flex">
          {section && <section.icon className="size-4" />}
          <span className="truncate">{section?.label ?? "Diva"}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setSearch(true)}
            className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-subtle transition-colors hover:border-border-strong hover:text-muted sm:w-56"
            aria-label="Search (Ctrl+K)"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="ml-auto hidden rounded border border-border px-1 font-mono text-2xs sm:inline">⌘K</kbd>
          </button>

          <P.Root>
            <P.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Quick links" title="Quick links"><LayoutGrid /></Button>
            </P.Trigger>
            <P.Portal>
              <P.Content align="end" sideOffset={8} className="z-50 w-[min(300px,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-2 shadow-2xl">
                <p className="px-2 pb-2 pt-1 eyebrow">Quick links</p>
                <div className="grid grid-cols-3 gap-1">
                  {QUICK_LINK_DEFS.filter((d) => app.links[d.key]).map((d) => (
                    <a key={d.key} href={app.links[d.key]} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 rounded-md px-1 py-2.5 text-center text-2xs text-muted hover:bg-surface-2 hover:text-fg">
                      <LinkMark k={d.key} className="size-8 text-xs" />
                      <span className="line-clamp-2 leading-tight">{d.label}</span>
                    </a>
                  ))}
                </div>
                <P.Close asChild>
                  <Link href="/settings#quick-links" className="mt-1 block rounded-md px-2 py-2 text-center text-xs text-accent hover:bg-surface-2">Edit quick links</Link>
                </P.Close>
              </P.Content>
            </P.Portal>
          </P.Root>

          <P.Root>
            <P.Trigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label={`Reminders: ${urgent.length} need attention`}>
                <Bell />
                {urgent.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold text-accent-fg">
                    {urgent.length}
                  </span>
                )}
              </Button>
            </P.Trigger>
            <P.Portal>
              <P.Content align="end" sideOffset={8} className="z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-2 shadow-2xl">
                <p className="px-2 pb-2 pt-1 eyebrow">Needs attention</p>
                {reminders.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {reminders.slice(0, 8).map((r) => (
                      <li key={r.groupKey}>
                        <P.Close asChild>
                          <Link href={r.href} className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-surface-2">
                            <CategoryDot color={app.catBySlug(r.category_slug ?? "other").color} className="mt-1.5" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{r.title}</p>
                              <p className={cn("text-2xs", r.bucket === "overdue" ? "text-danger" : "text-subtle")}>
                                {r.bucket === "overdue" ? "Overdue · " : ""}{relativeDay(r.event_date, app.today)}
                              </p>
                            </div>
                          </Link>
                        </P.Close>
                      </li>
                    ))}
                  </ul>
                )}
                <P.Close asChild>
                  <Link href="/dashboard#reminders" className="mt-1 block rounded-md px-2 py-2 text-center text-xs text-accent hover:bg-surface-2">Open reminders</Link>
                </P.Close>
              </P.Content>
            </P.Portal>
          </P.Root>

          <Button variant="primary" size="sm" onClick={() => app.newTask()} aria-label="Add task">
            <Plus /><span className="hidden sm:inline">Add task</span>
          </Button>
        </div>
      </div>
      <SearchPalette open={search} onOpenChange={setSearch} />
    </header>
  );
}
