"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt, monthKey, monthMatrix, shiftMonth } from "@/lib/dates";
import type { AgendaItem } from "@/lib/services/agenda";
import { Button } from "@/components/ui/button";
import { Badge, CategoryDot, EmptyState, SectionCard } from "@/components/ui/bits";
import { useApp } from "@/components/shell/app-provider";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Single colour => filled disc. Several => evenly segmented ring (max 4 segments, legible). */
export function dayIndicatorStyle(colors: string[]): React.CSSProperties | undefined {
  if (!colors.length) return undefined;
  if (colors.length === 1) return { background: colors[0] };
  const cs = colors.slice(0, 4);
  const step = 360 / cs.length;
  const gap = 4;
  const stops = cs.map((c, i) => `${c} ${i * step + gap / 2}deg ${(i + 1) * step - gap / 2}deg, transparent ${(i + 1) * step - gap / 2}deg ${(i + 1) * step + gap / 2}deg`);
  return { background: `conic-gradient(from -${gap / 2}deg, ${stops.join(", ")})` };
}

export function Calendar({ items }: { items: AgendaItem[] }) {
  const app = useApp();
  const [month, setMonth] = useState(monthKey(app.today));
  const [selected, setSelected] = useState(app.today);
  const days = useMemo(() => monthMatrix(month), [month]);

  const byDate = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    return m;
  }, [items]);

  const selItems = byDate.get(selected) ?? [];
  const legend = app.categories;

  return (
    <SectionCard
      title="Calendar"
      icon={CalendarDays}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => { setMonth(monthKey(app.today)); setSelected(app.today); }} disabled={month === monthKey(app.today) && selected === app.today}>Today</Button>
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
          <span className="min-w-[110px] text-center text-[13px] font-medium" aria-live="polite">{fmt.month(month)}</span>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
        </>
      }
    >
      <div role="grid" aria-label={fmt.month(month)} className="select-none">
        <div role="row" className="grid grid-cols-7 pb-1">
          {WEEKDAYS.map((d) => <div role="columnheader" key={d} className="text-center text-2xs font-medium uppercase tracking-wider text-subtle">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((d) => {
            const its = byDate.get(d) ?? [];
            const open = its.filter((i) => !i.done);
            const colors = Array.from(new Set((open.length ? open : its).map((i) => i.color)));
            const inMonth = d.startsWith(month);
            const isToday = d === app.today;
            const isSel = d === selected;
            const overdue = d < app.today && its.some((i) => i.kind === "task" && !i.done);
            const label = `${fmt.dayLong(d)}${its.length ? `, ${its.length} item${its.length > 1 ? "s" : ""}` : ""}${overdue ? ", has overdue tasks" : ""}`;
            return (
              <div role="gridcell" key={d} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => { setSelected(d); if (!inMonth) setMonth(monthKey(d)); }}
                  aria-label={label}
                  aria-pressed={isSel}
                  className={cn(
                    "relative flex h-10 w-10 flex-col items-center justify-center rounded-lg transition-colors sm:h-11 sm:w-11",
                    isSel ? "bg-surface-3 ring-1 ring-border-strong" : "hover:bg-surface-2",
                    !inMonth && "opacity-35",
                  )}
                >
                  <span className="relative flex size-7 items-center justify-center">
                    {colors.length > 0 && (
                      <span
                        className={cn("absolute inset-0 rounded-full", colors.length > 1 && "[mask:radial-gradient(circle,transparent_9px,#000_9.5px)]", open.length === 0 && "opacity-40")}
                        style={dayIndicatorStyle(colors)}
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        "relative num text-[13px]",
                        colors.length === 1 ? "font-semibold text-[#14151a]" : "text-fg",
                        colors.length === 1 && open.length === 0 && "text-fg",
                        isToday && colors.length !== 1 && "font-semibold text-accent",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </span>
                  {isToday && <span className="absolute bottom-0.5 h-[3px] w-3 rounded-full bg-accent" aria-hidden />}
                  {overdue && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-danger" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border pt-3">
        {legend.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-2xs text-muted"><CategoryDot color={c.color} />{c.name}</span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-2xs text-muted"><span className="size-1.5 rounded-full bg-danger" />Overdue</span>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-medium">{selected === app.today ? "Today" : fmt.dayLong(selected)}</h3>
          <Button size="sm" variant="ghost" onClick={() => app.newTask({ due_date: selected })}><Plus />Add</Button>
        </div>
        {selItems.length === 0 ? (
          <EmptyState title="Nothing scheduled" className="py-5">Pick another date or add a task for this day.</EmptyState>
        ) : (
          <ul className="space-y-1">
            {selItems.map((it) => {
              const body = (
                <>
                  <CategoryDot color={it.color} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", it.done && "text-subtle line-through")}>{it.title}</p>
                    <p className="truncate text-2xs text-subtle">
                      {it.meta ?? app.catById(it.categoryId).name}
                      {it.time ? ` · ${fmt.time(it.time)}` : ""}
                    </p>
                  </div>
                  {it.kind === "task" && !it.done && it.date < app.today && <Badge tone="danger">Overdue</Badge>}
                  {it.done && <Badge tone="ok">Done</Badge>}
                </>
              );
              const cls = "flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2";
              return (
                <li key={it.key}>
                  {it.kind === "task" ? (
                    <button type="button" className={cls} onClick={() => app.openTask(it.id)}>{body}</button>
                  ) : (
                    <Link href={it.href} className={cls}>{body}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
