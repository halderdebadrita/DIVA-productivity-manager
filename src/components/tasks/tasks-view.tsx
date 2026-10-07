"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, FolderKanban, Inbox, ListChecks, Plus, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITY_RANK, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { addDays, fmt, relativeDay } from "@/lib/dates";
import type { Milestone, Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/bits";
import { Input, Select } from "@/components/ui/form";
import { TaskRow } from "./task-row";
import { useApp } from "@/components/shell/app-provider";
import { ProjectStatusChart } from "./project-status-chart";

interface ProjectSummary { id: string; name: string; status: string; progress: number; deadline: string | null; nextMilestone: Milestone | null }

const VIEWS = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "upcoming", label: "Upcoming", icon: ListChecks },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;
const EXTRA = { today: "Due today", overdue: "Overdue" } as Record<string, string>;

export function TasksView({ tasks, projects, milestones, initialView }: { tasks: Task[]; projects: ProjectSummary[]; milestones: Milestone[]; initialView: string }) {
  const app = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [view, setViewState] = useState(initialView);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [prio, setPrio] = useState("all");
  const [sort, setSort] = useState("due");

  const setView = (v: string) => {
    setViewState(v);
    router.replace(`${pathname}?view=${v}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (cat === "all" || t.category_id === cat) &&
        (prio === "all" || t.priority === prio) &&
        (!needle || t.title.toLowerCase().includes(needle) || t.description?.toLowerCase().includes(needle)),
    );
  }, [tasks, q, cat, prio]);

  const sorter = (a: Task, b: Task) => {
    if (sort === "priority") return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    if (sort === "created") return b.created_at.localeCompare(a.created_at);
    if (sort === "title") return a.title.localeCompare(b.title);
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99");
  };

  const open = filtered.filter((t) => t.status !== "done");
  const counts = {
    inbox: open.filter((t) => !t.due_date && !t.project_id).length,
    upcoming: open.filter((t) => t.due_date).length,
    projects: open.filter((t) => t.project_id).length,
    completed: filtered.filter((t) => t.status === "done").length,
  } as Record<string, number>;

  let content: React.ReactNode;
  if (view === "projects") {
    content = <ProjectsTaskView tasks={filtered} projects={projects} milestones={milestones} sorter={sorter} />;
  } else if (view === "completed") {
    const done = filtered.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    content = done.length ? <ul className="card p-2">{done.map((t) => <TaskRow key={t.id} task={t} />)}</ul> : <EmptyState icon={CheckCircle2} title="No completed tasks yet">Completed tasks keep their completion date here.</EmptyState>;
  } else if (view === "upcoming" || view === "today" || view === "overdue") {
    let list = open.filter((t) => t.due_date).sort(sorter);
    if (view === "today") list = filtered.filter((t) => t.due_date === app.today).sort(sorter);
    if (view === "overdue") list = list.filter((t) => t.due_date! < app.today);
    const groups = new Map<string, Task[]>();
    for (const t of list) {
      const d = t.due_date!;
      const label = d < app.today ? "Overdue" : d === app.today ? "Today" : d === addDays(app.today, 1) ? "Tomorrow" : d <= addDays(app.today, 7) ? "This week" : d.slice(0, 7) === app.today.slice(0, 7) ? "Later this month" : fmt.month(d.slice(0, 7));
      groups.set(label, [...(groups.get(label) ?? []), t]);
    }
    content = list.length ? (
      <div className="space-y-4">
        {[...groups].map(([label, ts]) => (
          <section key={label} className="card p-2">
            <h3 className={cn("px-2 pb-1 pt-1.5 eyebrow", label === "Overdue" && "!text-danger")}>{label} · <span className="num">{ts.length}</span></h3>
            <ul>{ts.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          </section>
        ))}
      </div>
    ) : (
      <EmptyState icon={ListChecks} title={view === "overdue" ? "Nothing overdue" : "No dated tasks"}>{view === "overdue" ? "You're on top of things." : "Tasks with due dates appear here, soonest first."}</EmptyState>
    );
  } else {
    const inbox = open.filter((t) => !t.due_date && !t.project_id).sort(sorter);
    content = (
      <div className="space-y-3">
        <QuickCapture />
        {inbox.length ? <ul className="card p-2">{inbox.map((t) => <TaskRow key={t.id} task={t} />)}</ul> : <EmptyState icon={Inbox} title="Inbox zero">Capture anything without a date here, then give it a date or project when you're ready.</EmptyState>}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every assignment, study session, follow-up and errand — one list, many views."
        actions={<Button variant="primary" onClick={() => app.newTask()}><Plus />Add task</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Task views" className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition-colors", view === v.key ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}
            >
              <v.icon className="size-3.5" />{v.label}
              <span className="num text-2xs text-subtle">{counts[v.key]}</span>
            </button>
          ))}
          {EXTRA[view] && <span className="flex shrink-0 items-center rounded-md bg-accent/15 px-3 py-1.5 text-[13px] text-accent">{EXTRA[view]}</span>}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[180px] flex-1 lg:max-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="h-8 py-1 pl-8 text-[13px]" />
          </div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="h-8 w-auto py-1 text-[13px]">
            <option value="all">All categories</option>
            {app.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Priority" className="h-8 w-auto py-1 text-[13px]">
            <option value="all">Any priority</option>
            <option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="h-8 w-auto py-1 text-[13px]">
            <option value="due">Sort: due date</option>
            <option value="priority">Sort: priority</option>
            <option value="created">Sort: newest</option>
            <option value="title">Sort: A–Z</option>
          </Select>
        </div>
      </div>
      {content}
    </div>
  );
}

function QuickCapture() {
  const app = useApp();
  return (
    <button onClick={() => app.newTask()} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-left text-sm text-subtle transition-colors hover:border-border-strong hover:text-muted">
      <Plus className="size-4" />Capture a task…
    </button>
  );
}

function ProjectsTaskView({ tasks, projects, milestones, sorter }: { tasks: Task[]; projects: ProjectSummary[]; milestones: Milestone[]; sorter: (a: Task, b: Task) => number }) {
  const app = useApp();
  const counts = PROJECT_STATUSES.map((s) => ({ ...s, count: projects.filter((p) => p.status === s.value).length }));
  if (!projects.length) return <EmptyState icon={FolderKanban} title="No projects yet" action={<Link className="text-sm text-accent hover:underline" href="/projects">Create a project</Link>}>Tasks linked to projects and milestones appear here.</EmptyState>;
  return (
    <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {projects.map((p) => {
          const ts = tasks.filter((t) => t.project_id === p.id);
          const openTs = ts.filter((t) => t.status !== "done").sort(sorter);
          const ms = milestones.filter((m) => m.project_id === p.id);
          return (
            <section key={p.id} className="card">
              <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3">
                <Link href={`/projects/${p.id}`} className="min-w-0 font-medium hover:underline">{p.name}</Link>
                <Badge>{PROJECT_STATUS_LABEL[p.status as keyof typeof PROJECT_STATUS_LABEL]}</Badge>
                <div className="flex min-w-[140px] flex-1 items-center gap-2">
                  <ProgressBar value={p.progress} label={`${p.name} progress`} />
                  <span className="num text-2xs text-muted">{p.progress}%</span>
                </div>
                {p.nextMilestone && <span className="text-2xs text-subtle">Next: {p.nextMilestone.title}{p.nextMilestone.due_date ? ` · ${relativeDay(p.nextMilestone.due_date, app.today)}` : ""}</span>}
                {p.deadline && <span className="text-2xs text-subtle">Due {fmt.day(p.deadline)}</span>}
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => app.newTask({ project_id: p.id, category_id: app.catBySlug("projects").id })}><Plus />Task</Button>
              </header>
              <div className="p-2">
                {openTs.length ? (
                  <ul>
                    {openTs.map((t) => {
                      const m = ms.find((x) => x.id === t.milestone_id);
                      return (
                        <div key={t.id}>
                          {m && <p className="ml-9 mt-1 text-2xs text-subtle">Milestone · {m.title}</p>}
                          <TaskRow task={t} />
                        </div>
                      );
                    })}
                  </ul>
                ) : <p className="px-2 py-3 text-sm text-muted">No open tasks{ts.length ? ` · ${ts.length} completed` : ""}.</p>}
              </div>
            </section>
          );
        })}
      </div>
      <aside className="card h-fit p-4">
        <h3 className="section-title">Projects by status</h3>
        <ProjectStatusChart data={counts.map((c) => ({ name: c.label, value: c.count, color: c.color }))} />
        <p className="mt-2 text-2xs text-subtle">Status distribution only — each project&apos;s completion is its own progress bar.</p>
      </aside>
    </div>
  );
}
