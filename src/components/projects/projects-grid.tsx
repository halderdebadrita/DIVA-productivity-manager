"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderKanban, GitBranch } from "lucide-react";
import { cn } from "@/lib/cn";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { fmt, relativeDay } from "@/lib/dates";
import type { Milestone, Project } from "@/lib/types";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/bits";
import { Select } from "@/components/ui/form";
import { useApp } from "@/components/shell/app-provider";

export interface ProjectCardData extends Project { effective: number; next: Milestone | null; syncedAt: string | null; pushedAt: string | null }

export function ProjectsGrid({ projects }: { projects: ProjectCardData[] }) {
  const app = useApp();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const list = projects
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) =>
      sort === "status" ? PROJECT_STATUSES.findIndex((s) => s.value === a.status) - PROJECT_STATUSES.findIndex((s) => s.value === b.status)
      : sort === "deadline" ? (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")
      : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filter projects" className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {[{ value: "all", label: "All Projects" }, ...PROJECT_STATUSES].map((s) => (
            <button key={s.value} role="tab" aria-selected={filter === s.value} onClick={() => setFilter(s.value)} className={cn("shrink-0 rounded-md px-3 py-1 text-[13px]", filter === s.value ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
              {s.label} <span className="num text-2xs text-subtle">{s.value === "all" ? projects.length : projects.filter((p) => p.status === s.value).length}</span>
            </button>
          ))}
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects" className="ml-auto h-8 w-auto py-1 text-[13px]">
          <option value="updated">Recently updated</option><option value="status">Status</option><option value="deadline">Upcoming deadline</option>
        </Select>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects here">Create a project to track milestones, tasks, GitHub activity and demos.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const st = PROJECT_STATUSES.find((s) => s.value === p.status)!;
            return (
              <article key={p.id} className="card group relative flex flex-col p-4 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0 group-hover:underline">{p.name}</Link>
                  </h3>
                  <Badge><span className="size-1.5 rounded-full" style={{ background: st.color }} />{PROJECT_STATUS_LABEL[p.status]}</Badge>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.description}</p>}
                {p.tech_stack.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">{p.tech_stack.slice(0, 5).map((t) => <span key={t} className="rounded bg-surface-3 px-1.5 py-0.5 text-2xs text-muted">{t}</span>)}</div>
                )}
                <div className="mt-auto pt-4">
                  <div className="mb-1 flex items-center justify-between text-2xs text-subtle">
                    <span>Progress{p.progress_mode === "milestones" ? " · milestones" : p.progress_mode === "github" ? " · from GitHub" : ""}</span>
                    <span className="num text-fg">{p.effective}%</span>
                  </div>
                  <ProgressBar value={p.effective} color={st.color} label={`${p.name} progress`} />
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-subtle">
                    {p.next && <span className="truncate">Next: {p.next.title}</span>}
                    {p.deadline && <span className={cn(p.status !== "completed" && p.deadline < app.today && "text-danger")}>Due {relativeDay(p.deadline, app.today)}</span>}
                    <span>{p.pushedAt ? `Last push ${fmt.instant(p.pushedAt, app.tz)}` : `Updated ${fmt.instant(p.updated_at, app.tz)}`}</span>
                  </div>
                </div>
                {(p.repo_url || p.demo_url) && (
                  <div className="relative z-10 mt-3 flex gap-1.5 border-t border-border pt-3">
                    {p.repo_url && <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-2xs text-muted hover:bg-surface-3 hover:text-fg"><GitBranch className="size-3" />Repository</a>}
                    {p.demo_url && <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-2xs text-muted hover:bg-surface-3 hover:text-fg"><ExternalLink className="size-3" />Live demo</a>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
