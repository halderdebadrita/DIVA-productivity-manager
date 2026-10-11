"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITY_RANK, TASK_STATUS_LABEL } from "@/lib/constants";
import { fmt, monthKey, shiftMonth } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, CategoryTag, EmptyState, PriorityBadge, SectionCard } from "@/components/ui/bits";
import { Select } from "@/components/ui/form";
import { TaskCheckbox } from "@/components/tasks/task-row";
import { useApp } from "@/components/shell/app-provider";

export function MonthTasks({ tasks }: { tasks: Task[] }) {
  const app = useApp();
  const [month, setMonth] = useState(monthKey(app.today));
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("open");
  const [showDone, setShowDone] = useState(false);

  const inMonth = useMemo(
    () =>
      tasks
        .filter((t) => t.due_date?.startsWith(month))
        .filter((t) => cat === "all" || t.category_id === cat)
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99")),
    [tasks, month, cat],
  );
  const open = inMonth.filter((t) => t.status !== "done" && (status === "open" || status === "all" || t.status === status));
  const done = inMonth.filter((t) => t.status === "done");
  const visibleOpen = status === "done" ? [] : open;
  const total = inMonth.length;

  const Row = ({ t }: { t: Task }) => {
    const c = app.catById(t.category_id);
    const overdue = t.status !== "done" && t.due_date! < app.today;
    return (
      <li className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0">
        <TaskCheckbox task={t} />
        <span className={cn("w-[52px] shrink-0 num text-2xs", overdue ? "text-danger" : "text-subtle")}>{fmt.day(t.due_date!)}</span>
        <button type="button" onClick={() => app.openTask(t)} className={cn("min-w-0 flex-1 truncate text-left text-sm", t.status === "done" && "text-subtle line-through")}>{t.title}</button>
        <span className="hidden sm:inline-flex"><CategoryTag name={c.name} color={c.color} /></span>
        <span className="sm:hidden"><span className="block size-2.5 rounded-full" style={{ background: c.color }} aria-label={c.name} role="img" /></span>
        <PriorityBadge priority={t.priority} compact />
        <span className="hidden w-[74px] text-right text-2xs text-subtle md:inline">{TASK_STATUS_LABEL[t.status]}</span>
      </li>
    );
  };

  return (
    <SectionCard
      title="Tasks this month"
      icon={ListTodo}
      actions={
        <>
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
          <span className="min-w-[110px] text-center text-[13px] font-medium">{fmt.month(month)}</span>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)} className="h-8 w-auto py-1 text-[13px]">
          <option value="all">All categories</option>
          {app.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-auto py-1 text-[13px]">
          <option value="open">Open</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="done">Completed</option>
          <option value="all">All</option>
        </Select>
        <span className="ml-auto text-2xs text-subtle num">{done.length}/{total} done</span>
      </div>
      {total === 0 ? (
        <EmptyState title={`No tasks due in ${fmt.month(month)}`}>Tasks with a due date this month will appear here.</EmptyState>
      ) : (
        <>
          {visibleOpen.length > 0 ? <ul>{visibleOpen.map((t) => <Row key={t.id} t={t} />)}</ul> : status !== "done" && <p className="py-3 text-center text-sm text-muted">Nothing open with these filters 🎉</p>}
          {done.length > 0 && (status === "done" || status === "all" || status === "open") && (
            <div className="mt-2">
              {status !== "done" && (
                <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="flex items-center gap-1 text-2xs text-subtle hover:text-fg">
                  <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                  Completed <Badge>{done.length}</Badge>
                </button>
              )}
              {(showDone || status === "done") && <ul className="opacity-70">{done.map((t) => <Row key={t.id} t={t} />)}</ul>}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
