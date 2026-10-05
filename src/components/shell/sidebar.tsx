"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/actions/misc";
import { NAV, SETTINGS } from "./nav";
import { DivaMark } from "./logo";
import { useApp } from "./app-provider";

const KEY = "diva.sidebar.collapsed";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? n.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                collapsed && "justify-center px-0",
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-accent" aria-hidden />}
              <n.icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "")} />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AccountBlock({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const app = useApp();
  const active = isActive(pathname, SETTINGS.href);
  return (
    <div className="space-y-1 border-t border-border pt-3">
      <Link
        href={SETTINGS.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? "Settings" : undefined}
        className={cn("flex items-center gap-3 rounded-md px-2.5 py-2 text-sm", active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg", collapsed && "justify-center px-0")}
      >
        <SETTINGS.icon className={cn("size-[18px]", active && "text-accent")} />
        {!collapsed && "Settings"}
      </Link>
      <div className={cn("flex items-center gap-2.5 rounded-md px-2 py-2", collapsed && "justify-center px-0")}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-fg" aria-hidden>
          {app.displayName.slice(0, 1).toUpperCase()}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{app.displayName}</p>
            <p className="truncate text-2xs text-subtle">{app.mode === "demo" ? "Local mode · this computer" : app.email}</p>
          </div>
        )}
        {!collapsed && app.mode === "supabase" && (
          <form action={signOutAction}>
            <button className="rounded p-1 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };
  return (
    <aside
      className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface px-3 py-4 transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-[232px]")}
      aria-label="Main navigation"
    >
      <div className={cn("mb-6 flex items-center gap-2.5 px-1.5", collapsed && "justify-center px-0")}>
        <DivaMark />
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight">Diva</span>}
      </div>
      <nav className="flex-1">
        <NavLinks collapsed={collapsed} />
      </nav>
      <AccountBlock collapsed={collapsed} />
      <button
        onClick={toggle}
        className={cn("mt-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-2xs text-subtle hover:bg-surface-2 hover:text-fg", collapsed && "justify-center px-0")}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" />Collapse</>}
      </button>
    </aside>
  );
}
