"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, ExternalLink, FolderKanban, GitBranch, Pin, PinOff, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { fmt, relativeDay } from "@/lib/dates";
import type { Milestone, Project } from "@/lib/types";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/bits";
import { Select } from "@/components/ui/form";
import { Confirm } from "@/components/ui/confirm";
import { ContextMenu, type MenuItem } from "@/components/ui/context-menu";
import { deleteProjectAction, patchProjectAction, pinProjectAction } from "@/app/actions/entities";
import type { ProjectStatus } from "@/lib/types";
import { useApp } from "@/components/shell/app-provider";

export interface ProjectCardData extends Project { effective: number; next: Milestone | null; syncedAt: string | null; pushedAt: string | null }

export function ProjectsGrid({ projects, pinned = [] }: { projects: ProjectCardData[]; pinned?: string[] }) {
  const app = useApp();
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  // optimistic copies of server state, re-synced whenever the page re-renders
  const [pins, setPins] = useState(pinned);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [statusOf, setStatusOf] = useState<Record<string, ProjectStatus>>({});
  useEffect(() => setPins(pinned), [pinned]);
  useEffect(() => setStatusOf({}), [projects]);
  const [menu, setMenu] = useState<{ x: number; y: number; project: ProjectCardData } | null>(null);
  const [deleting, setDeleting] = useState<ProjectCardData | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const togglePin = async (p: ProjectCardData) => {
    const on = !pins.includes(p.id);
    setPins((cur) => (on ? [p.id, ...cur] : cur.filter((x) => x !== p.id)));
    const r = await pinProjectAction(p.id, on);
    if (!r.ok) {
      setPins(pinned);
      return void toast.error(r.error);
    }
    toast.success(on ? `Pinned ${p.name} to the top` : `Unpinned ${p.name}`);
  };
  const setStatus = async (p: ProjectCardData, status: ProjectStatus) => {
    setStatusOf((m) => ({ ...m, [p.id]: status }));
    const r = await patchProjectAction(p.id, { status });
    if (!r.ok) {
      setStatusOf((m) => ({ ...m, [p.id]: p.status }));
      return void toast.error(r.error);
    }
  };
  const remove = async (p: ProjectCardData) => {
    const r = await deleteProjectAction(p.id);
    if (!r.ok) return void toast.error(r.error);
    setHidden((h) => new Set(h).add(p.id));
    toast.success(`Deleted ${p.name}`);
    router.refresh();
  };

  const menuItems = (p: ProjectCardData): MenuItem[] => [
    pins.includes(p.id) ? { label: "Unpin", icon: PinOff, onSelect: () => togglePin(p) } : { label: "Pin to top", icon: Pin, onSelect: () => togglePin(p) },
    { label: "Open", icon: ArrowUpRight, onSelect: () => router.push(`/projects/${p.id}`) },
    { label: "Open in new tab", icon: SquareArrowOutUpRight, onSelect: () => window.open(`/projects/${p.id}`, "_blank", "noopener") },
    { type: "separator" },
    { type: "label", label: "Status" },
    ...PROJECT_STATUSES.map((st): MenuItem => ({ label: st.label, active: p.status === st.value, onSelect: () => p.status !== st.value && setStatus(p, st.value) })),
    ...(p.repo_url || p.demo_url ? [{ type: "separator" } as MenuItem] : []),
    ...(p.repo_url ? [{ label: "Open repository", icon: GitBranch, onSelect: () => window.open(p.repo_url!, "_blank", "noopener") } as MenuItem] : []),
    ...(p.demo_url ? [{ label: "Open live demo", icon: ExternalLink, onSelect: () => window.open(p.demo_url!, "_blank", "noopener") } as MenuItem] : []),
    { type: "separator" },
    { label: "Delete project", icon: Trash2, danger: true, onSelect: () => setDeleting(p) },
  ];

  const pinRank = (id: string) => (pins.includes(id) ? pins.indexOf(id) : Infinity);
  const list = projects
    .filter((p) => !hidden.has(p.id))
    .map((p) => (statusOf[p.id] ? { ...p, status: statusOf[p.id] } : p))
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) =>
      pinRank(a.id) !== pinRank(b.id) ? (pinRank(a.id) < pinRank(b.id) ? -1 : 1)
      : sort === "status" ? PROJECT_STATUSES.findIndex((s) => s.value === a.status) - PROJECT_STATUSES.findIndex((s) => s.value === b.status)
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
              <article
                key={p.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, project: p });
                }}
                className={cn("card group relative flex flex-col p-4 transition-colors hover:border-border-strong", menu?.project.id === p.id && "border-border-strong")}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0 group-hover:underline">{p.name}</Link>
                  </h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {pins.includes(p.id) && <Pin className="size-3.5 rotate-45 text-accent" aria-label="Pinned" />}
                    <Badge><span className="size-1.5 rounded-full" style={{ background: st.color }} />{PROJECT_STATUS_LABEL[p.status]}</Badge>
                  </div>
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
      {list.length > 0 && <p className="mt-3 text-2xs text-subtle">Tip: right-click a project to pin it, change its status or delete it.</p>}
      <ContextMenu at={menu} items={menu ? menuItems(menu.project) : []} onClose={closeMenu} />
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "project"}?`}
        description={`This removes the project, its milestones and its notes from Diva.${deleting?.repo_url ? " The GitHub repository itself isn't touched, and Diva won't re-import it." : ""}`}
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  );
}
