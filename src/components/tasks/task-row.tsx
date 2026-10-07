"use client";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Check, Clock, FolderKanban, GraduationCap, Link2, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt, relativeDay } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { toggleTaskAction } from "@/app/actions/tasks";
import { CategoryTag, PriorityBadge, Badge } from "@/components/ui/bits";
import { useApp } from "@/components/shell/app-provider";

export function TaskCheckbox({ task, className }: { task: Task; className?: string }) {
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(task.status === "done");
  const toggle = () =>
    start(async () => {
      const next = !done;
      setDone(next);
      const r = await toggleTaskAction(task.id, next);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(next ? "Completed" : "Reopened", {
        description: task.title,
        action: { label: "Undo", onClick: () => toggleTaskAction(task.id, !next) },
      });
    });
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
      onClick={toggle}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        done ? "border-accent bg-accent text-accent-fg" : "border-border-strong hover:border-accent",
        className,
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

export function TaskRow({ task, showDate = true, dense = false }: { task: Task; showDate?: boolean; dense?: boolean }) {
  const app = useApp();
  const cat = app.catById(task.category_id);
  const done = task.status === "done";
  const overdue = !done && !!task.due_date && task.due_date < app.today;
  const project = task.project_id ? app.projects.find((p) => p.id === task.project_id) : null;
  const test = task.test_id ? app.tests.find((t) => t.id === task.test_id) : null;
  const hack = task.hackathon_id ? app.hackathons.find((h) => h.id === task.hackathon_id) : null;
  const assoc = project ? { icon: FolderKanban, label: project.name } : test ? { icon: GraduationCap, label: test.name } : hack ? { icon: Trophy, label: hack.name } : null;

  return (
    <li className={cn("group relative flex items-start gap-3 rounded-md px-2 transition-colors hover:bg-surface-2", dense ? "py-1.5" : "py-2")}>
      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: cat.color }} aria-hidden />
      <TaskCheckbox task={task} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => app.openTask(task)} className={cn("block w-full truncate text-left text-sm", done && "text-subtle line-through")}>
          {task.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <CategoryTag name={cat.name} color={cat.color} />
          {assoc && (
            <span className="inline-flex max-w-[180px] items-center gap-1 truncate text-2xs text-subtle">
              <assoc.icon className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{assoc.label}</span>
            </span>
          )}
          {task.link_url && <Link2 className="size-3 text-subtle" aria-label="Has a link" />}
          {done && task.completed_at && <span className="text-2xs text-subtle">Done {fmt.instant(task.completed_at, app.tz)}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {overdue && <Badge tone="danger">Overdue</Badge>}
          {!done && task.status === "in_progress" && <Badge tone="accent">In progress</Badge>}
          <PriorityBadge priority={task.priority} compact={dense} />
        </div>
        {(showDate || task.due_time) && (task.due_date || task.due_time) && (
          <span className={cn("inline-flex items-center gap-1 text-2xs num", overdue ? "text-danger" : "text-subtle")}>
            {task.due_time && <Clock className="size-3" aria-hidden />}
            {showDate && task.due_date ? relativeDay(task.due_date, app.today) : ""}
            {task.due_time ? `${showDate && task.due_date ? " · " : ""}${fmt.time(task.due_time)}` : ""}
          </span>
        )}
      </div>
    </li>
  );
}
