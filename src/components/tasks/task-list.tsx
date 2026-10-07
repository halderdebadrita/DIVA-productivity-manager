"use client";
import { Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import { sortChronologicalClient } from "@/lib/task-sort";
import { Button } from "@/components/ui/button";
import { TaskRow } from "./task-row";
import { useApp } from "@/components/shell/app-provider";

/** Compact list of linked tasks (same shared task records) with an add button pre-linked to the entity. */
export function TaskList({ tasks, emptyText, addDraft }: { tasks: Task[]; today: string; emptyText: string; addDraft?: { project_id?: string; hackathon_id?: string; test_id?: string; milestone_id?: string; slug: string } }) {
  const app = useApp();
  const open = tasks.filter((t) => t.status !== "done").sort(sortChronologicalClient);
  const done = tasks.filter((t) => t.status === "done");
  return (
    <div>
      {open.length ? <ul className="-mx-2">{open.map((t) => <TaskRow key={t.id} task={t} dense />)}</ul> : <p className="py-2 text-sm text-muted">{emptyText}</p>}
      {done.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-2xs text-subtle hover:text-fg">{done.length} completed</summary>
          <ul className="-mx-2 opacity-70">{done.map((t) => <TaskRow key={t.id} task={t} dense />)}</ul>
        </details>
      )}
      {addDraft && (
        <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => {
          const { slug, ...links } = addDraft;
          app.newTask({ ...links, category_id: app.catBySlug(slug).id });
        }}><Plus />Add task</Button>
      )}
    </div>
  );
}
