import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, BookText, CalendarRange, GitBranch, LayoutGrid, ListChecks, MonitorPlay, Trophy } from "lucide-react";
import { getCtx } from "@/lib/context";
import { integrationStatus } from "@/lib/env";
import { fmt, relativeDay, todayIn } from "@/lib/dates";
import { PROJECT_RESOURCE_KINDS, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { effectiveProgress, getProject, listMilestones, nextMilestone } from "@/lib/services/projects";
import { getSnapshot } from "@/lib/services/github";
import { listResources } from "@/lib/services/resources";
import { listTasks } from "@/lib/services/tasks";
import { Badge, SectionCard } from "@/components/ui/bits";
import { ExternalButton } from "@/components/ui/link-button";
import { TabPanel, UrlTabs } from "@/components/ui/tabs";
import { AddResourceDialog, ResourceList } from "@/components/resources/resource-manager";
import { ProjectFormDialog } from "@/components/projects/project-form";
import { DeleteProject, DemoForm, DocsForm, GithubPanel, MilestonesPanel, NotesForm, OutcomeForm, ProgressEditor } from "@/components/projects/workspace";
import { TaskList } from "@/components/tasks/task-list";
import { GithubAutoRefresh } from "@/components/projects/github-import";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  const p = await getProject(ctx, id);
  if (!p) notFound();
  const [milestones, tasks, snapshot, resources] = await Promise.all([listMilestones(ctx, id), listTasks(ctx), getSnapshot(ctx, id), listResources(ctx, { type: "project", id })]);
  const today = todayIn(ctx.tz);
  const ptasks = tasks.filter((t) => t.project_id === id);
  const effective = effectiveProgress(p, milestones);
  const next = nextMilestone(p, milestones);
  const st = PROJECT_STATUSES.find((s) => s.value === p.status)!;
  const demoRes = resources.filter((r) => r.section === "demo");
  const docRes = resources.filter((r) => r.section !== "demo");
  const upcoming = [
    ...milestones.filter((m) => m.status !== "done" && m.due_date).map((m) => ({ k: m.id, t: m.title, d: m.due_date! })),
    ...ptasks.filter((t) => t.status !== "done" && t.due_date).map((t) => ({ k: t.id, t: t.title, d: t.due_date! })),
    ...(p.deadline && p.status !== "completed" ? [{ k: "dl", t: "Project deadline", d: p.deadline }] : []),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);

  return (
    <div>
      {p.repo_url && <GithubAutoRefresh projectId={p.id} />}
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><ArrowLeft className="size-3.5" />Projects</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{p.name}</h1>
            <Badge><span className="size-1.5 rounded-full" style={{ background: st.color }} />{PROJECT_STATUS_LABEL[p.status]}</Badge>
          </div>
          {p.description && <p className="mt-1 max-w-2xl text-sm text-muted">{p.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.repo_url && <ExternalButton href={p.repo_url}><GitBranch className="size-3.5" />Repository</ExternalButton>}
          {p.demo_url && <ExternalButton href={p.demo_url} variant="primary">Live demo</ExternalButton>}
          <ProjectFormDialog project={p} />
          <DeleteProject id={p.id} name={p.name} />
        </div>
      </div>

      <Suspense>
        <UrlTabs
          defaultValue="overview"
          tabs={[
            { value: "overview", label: "Overview", icon: <LayoutGrid /> },
            { value: "tasks", label: "Tasks & milestones", icon: <ListChecks /> },
            { value: "github", label: "GitHub", icon: <GitBranch /> },
            { value: "demo", label: "Demo & deployment", icon: <MonitorPlay /> },
            { value: "docs", label: "Documentation & files", icon: <BookText /> },
            { value: "outcomes", label: "Final outcomes", icon: <Trophy /> },
          ]}
        >
          <TabPanel value="overview">
            <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <SectionCard title="About">
                  <dl className="space-y-3 text-[13.5px]">
                    <div><dt className="eyebrow">Description</dt><dd className="mt-0.5 whitespace-pre-line text-muted">{p.description || "—"}</dd></div>
                    <div><dt className="eyebrow">Objective</dt><dd className="mt-0.5 whitespace-pre-line text-muted">{p.objective || "—"}</dd></div>
                    <div><dt className="eyebrow">Tech stack</dt><dd className="mt-1 flex flex-wrap gap-1">{p.tech_stack.length ? p.tech_stack.map((t) => <span key={t} className="rounded bg-surface-3 px-1.5 py-0.5 text-2xs">{t}</span>) : <span className="text-muted">—</span>}</dd></div>
                  </dl>
                </SectionCard>
                <SectionCard title="Blockers & notes"><NotesForm project={p} /></SectionCard>
              </div>
              <div className="space-y-4">
                <SectionCard title="Progress">
                  <ProgressEditor project={p} effective={effective} />
                  <p className="mt-3 text-2xs text-subtle">Progress is tracked independently of deadlines.</p>
                  {next && <p className="mt-3 text-[13px]"><span className="text-subtle">Next milestone:</span> {next.title}{next.due_date ? ` · ${relativeDay(next.due_date, today)}` : ""}</p>}
                </SectionCard>
                <SectionCard title="Important dates" icon={CalendarRange}>
                  <dl className="space-y-1.5 text-[13px]">
                    <div className="flex justify-between"><dt className="text-muted">Started</dt><dd className="num">{p.start_date ? fmt.day(p.start_date) : "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Deadline</dt><dd className="num">{p.deadline ? `${fmt.dayWithYear(p.deadline)}` : "—"}</dd></div>
                  </dl>
                  {upcoming.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3">
                      {upcoming.map((u) => <li key={u.k} className="flex justify-between gap-2 text-[13px]"><span className="truncate">{u.t}</span><span className={`num shrink-0 text-2xs ${u.d < today ? "text-danger" : "text-subtle"}`}>{relativeDay(u.d, today)}</span></li>)}
                    </ul>
                  )}
                </SectionCard>
              </div>
            </div>
          </TabPanel>
          <TabPanel value="tasks">
            <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
              <SectionCard title={`Milestones · ${milestones.filter((m) => m.status === "done").length}/${milestones.length}`}><MilestonesPanel projectId={p.id} milestones={milestones} tasks={ptasks} /></SectionCard>
              <SectionCard title="Project tasks"><TaskList tasks={ptasks.filter((t) => !t.milestone_id)} today={today} emptyText="No tasks outside milestones." addDraft={{ project_id: p.id, slug: "projects" }} /></SectionCard>
            </div>
          </TabPanel>
          <TabPanel value="github"><SectionCard title="Repository"><GithubPanel project={p} snapshot={snapshot} tokenConfigured={integrationStatus().github} /></SectionCard></TabPanel>
          <TabPanel value="demo" className="space-y-4">
            <SectionCard title="Links" actions={<>{p.demo_url && <ExternalButton href={p.demo_url}>Live</ExternalButton>}{p.video_url && <ExternalButton href={p.video_url}>Video</ExternalButton>}{p.presentation_url && <ExternalButton href={p.presentation_url}>Slides</ExternalButton>}</>}>
              <DemoForm project={p} />
            </SectionCard>
            <SectionCard title="Screenshots & supporting resources" actions={<AddResourceDialog entityType="project" entityId={p.id} kinds={PROJECT_RESOURCE_KINDS} section="demo" defaultKind="screenshot" label="Add" />}>
              {demoRes.length ? <ResourceList resources={demoRes} kinds={PROJECT_RESOURCE_KINDS} /> : <p className="text-sm text-muted">Upload screenshots or link demo assets.</p>}
            </SectionCard>
          </TabPanel>
          <TabPanel value="docs" className="space-y-4">
            <SectionCard title="Documentation" actions={p.docs_url ? <ExternalButton href={p.docs_url}>Open docs</ExternalButton> : undefined}><DocsForm project={p} /></SectionCard>
            <SectionCard title="Architecture, decisions, research & files" actions={<AddResourceDialog entityType="project" entityId={p.id} kinds={PROJECT_RESOURCE_KINDS} section="docs" defaultKind="documentation" label="Add" />}>
              {docRes.length ? <ResourceList resources={docRes} kinds={PROJECT_RESOURCE_KINDS} /> : <p className="text-sm text-muted">Save architecture notes, technical decisions, research and files here.</p>}
            </SectionCard>
          </TabPanel>
          <TabPanel value="outcomes">
            <SectionCard title="Final outcomes" actions={<>{p.demo_url && <ExternalButton href={p.demo_url}>Demo</ExternalButton>}{p.repo_url && <ExternalButton href={p.repo_url}>Repository</ExternalButton>}</>}>
              {p.status !== "completed" && <p className="mb-3 text-2xs text-subtle">Fill this in when the project wraps up — it&apos;s written for your portfolio and resume.</p>}
              <OutcomeForm project={p} />
            </SectionCard>
          </TabPanel>
        </UrlTabs>
      </Suspense>
    </div>
  );
}
