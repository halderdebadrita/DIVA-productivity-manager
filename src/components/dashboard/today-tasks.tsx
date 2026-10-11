"use client";
import Link from "next/link";
import { CheckCircle2, Plus, Sun } from "lucide-react";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionCard } from "@/components/ui/bits";
import { TaskRow } from "@/components/tasks/task-row";
import { useApp } from "@/components/shell/app-provider";

export function TodayTasks({ overdue, main, optional }: { overdue: Task[]; main: Task[]; optional: Task[] }) {
  const app = useApp();
  const empty = !overdue.length && !main.length && !optional.length;
  const Group = ({ label, tasks, tone }: { label: string; tasks: Task[]; tone?: string }) =>
    tasks.length ? (
      <div>
        <h3 className={`mb-1 px-2 eyebrow ${tone ?? ""}`}>{label} · <span className="num">{tasks.length}</span></h3>
        <ul className="space-y-0.5">{tasks.map((t) => <TaskRow key={t.id} task={t} showDate={label === "Overdue"} />)}</ul>
      </div>
    ) : null;
  return (
    <SectionCard
      title="Tasks for today"
      icon={Sun}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => app.newTask({ due_date: app.today })}><Plus />Add</Button>
          <Link href="/tasks" className="px-2 text-[13px] text-muted hover:text-fg">All tasks</Link>
        </>
      }
      bodyClassName="space-y-4 px-2 sm:px-3"
    >
      {empty ? (
        <EmptyState icon={CheckCircle2} title="Nothing due today" action={<Button size="sm" onClick={() => app.newTask({ due_date: app.today })}><Plus />Plan something</Button>}>
          Enjoy the space — or grab a side quest below.
        </EmptyState>
      ) : (
        <>
          <Group label="Overdue" tasks={overdue} tone="!text-danger" />
          <Group label="Due today" tasks={main} />
          <Group label="Optional · low priority" tasks={optional} />
        </>
      )}
    </SectionCard>
  );
}
