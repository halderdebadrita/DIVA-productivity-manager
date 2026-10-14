"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type MenuItem =
  | { type?: "item"; label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; active?: boolean; hint?: string }
  | { type: "separator" }
  | { type: "label"; label: string };

/** Right-click menu at the cursor. Closes on outside click, Escape, scroll or resize. Arrow keys move focus. */
export function ContextMenu({ at, items, onClose }: { at: { x: number; y: number } | null; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // keep the menu inside the viewport
  useLayoutEffect(() => {
    if (!at || !ref.current) return setPos(null);
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(at.x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(at.y, window.innerHeight - height - 8)) });
  }, [at]);
  // focus the first item once it's visible (hidden elements can't take focus)
  useEffect(() => {
    if (pos) ref.current?.querySelector<HTMLButtonElement>("button[role=menuitem]")?.focus();
  }, [pos]);

  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button[role=menuitem]") ?? [])];
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length]?.focus();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", key);
    };
  }, [at, onClose]);

  if (!at) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos?.x ?? at.x, top: pos?.y ?? at.y, visibility: pos ? "visible" : "hidden" }}
      className="fixed z-[55] min-w-[200px] rounded-lg border border-border bg-surface p-1 shadow-2xl"
    >
      {items.map((it, i) =>
        it.type === "separator" ? (
          <div key={i} role="separator" className="my-1 h-px bg-border" />
        ) : it.type === "label" ? (
          <div key={i} className="px-2.5 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-subtle">{it.label}</div>
        ) : (
          <button
            key={i}
            role="menuitem"
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none [&_svg]:size-4 [&_svg]:shrink-0",
              it.danger ? "text-danger hover:bg-danger/10 focus:bg-danger/10" : "text-fg hover:bg-surface-3 focus:bg-surface-3",
            )}
          >
            {it.icon ? <it.icon className={cn(!it.danger && "text-muted")} /> : <span className="size-4" />}
            <span className="flex-1">{it.label}</span>
            {it.active && <span className="size-1.5 rounded-full bg-accent" aria-label="current" />}
            {it.hint && <span className="text-2xs text-subtle">{it.hint}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
