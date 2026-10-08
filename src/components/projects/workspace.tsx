"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCircle2, CircleDashed, CircleDot, ListPlus, Sparkles, ExternalLink, GitBranch, GitCommit, Plus, RefreshCw, Save, Star, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt, relativeDay } from "@/lib/dates";
import type { GithubSnapshot, Milestone, Project, Task } from "@/lib/types";
import {
  analyzeProjectAction, deleteMilestoneAction, deleteProjectAction, patchProjectAction, remainingToMilestonesAction, saveMilestoneAction, syncGithubAction, toggleMilestoneAction,
} from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/bits";
import { Field, Input, Textarea, formObject } from "@/components/ui/form";
import { Confirm } from "@/components/ui/confirm";
import { ExternalButton } from "@/components/ui/link-button";
import { TaskRow } from "@/components/tasks/task-row";
import { useApp } from "@/components/shell/app-provider";

export function ProgressEditor({ project, effective }: { project: Project; effective: number }) {
  const [value, setValue] = useState(project.progress);
  const [pending, start] = useTransition();
  if (project.progress_mode === "github")
    return (
      <div>
        <div className="mb-1 flex justify-between text-2xs text-subtle"><span>Progress from GitHub analysis (AI)</span><span className="num text-fg">{effective}%</span></div>
        <ProgressBar value={effective} label="Project progress" />
      </div>
    );
  if (project.progress_mode === "milestones")
    return (
      <div>
        <div className="mb-1 flex justify-between text-2xs text-subtle"><span>Progress from completed milestones</span><span className="num text-fg">{effective}%</span></div>
        <ProgressBar value={effective} label="Project progress" />
      </div>
    );
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-2xs text-subtle">
        <label htmlFor="prog">Progress (manual)</label>
        <span className="num text-fg">{value}%</span>
      </div>
      <input id="prog" type="range" min={0} max={100} step={5} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-[rgb(214,255,112)]" />
      {value !== project.progress && (
        <Button size="sm" variant="primary" className="mt-2" loading={pending} onClick={() => start(async () => {
          const r = await patchProjectAction(project.id, { progress: value });
          if (r.ok) toast.success("Progress updated"); else toast.error(r.error);
        })}><Save />Save progress</Button>
      )}
    </div>
  );
}

export function MilestonesPanel({ projectId, milestones, tasks }: { projectId: string; milestones: Milestone[]; tasks: Task[] }) {
  const app = useApp();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    start(async () => {
      const r = await saveMilestoneAction(projectId, null, d);
      if (!r.ok) return setError(r.error);
      setError(null);
      setFormKey((k) => k + 1);
    });
  };
  const open = milestones.filter((m) => m.status !== "done");
  const done = milestones.filter((m) => m.status === "done");
  const M = ({ m }: { m: Milestone }) => {
    const ts = tasks.filter((t) => t.milestone_id === m.id);
    const overdue = m.status !== "done" && m.due_date && m.due_date < app.today;
    return (
      <li className="rounded-md border border-border bg-surface-2/50 p-2.5">
        <div className="flex items-center gap-2.5">
          <button
            role="checkbox"
            aria-checked={m.status === "done"}
            aria-label={`Mark milestone ${m.title} ${m.status === "done" ? "pending" : "done"}`}
            onClick={() => start(async () => { const r = await toggleMilestoneAction(m.id, m.status !== "done"); if (!r.ok) toast.error(r.error); })}
            className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-full border", m.status === "done" ? "border-ok bg-ok text-[#0d1a12]" : "border-border-strong hover:border-accent")}
          >
            {m.status === "done" && <Check className="size-3" strokeWidth={3} />}
          </button>
          <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", m.status === "done" && "text-subtle line-through")}>{m.title}</span>
          {m.due_date && <span className={cn("num text-2xs", overdue ? "text-danger" : "text-subtle")}>{relativeDay(m.due_date, app.today)}</span>}
          <Button size="icon" variant="ghost" aria-label={`Add task to ${m.title}`} title="Add task to milestone" onClick={() => app.newTask({ project_id: projectId, milestone_id: m.id, category_id: app.catBySlug("projects").id })}><Plus /></Button>
          <Confirm title="Delete milestone?" description="Tasks linked to it are kept and stay on the project." onConfirm={() => start(async () => { const r = await deleteMilestoneAction(m.id); if (!r.ok) toast.error(r.error); })}
            trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${m.title}`}><Trash2 /></Button>} />
        </div>
        {ts.length > 0 && <ul className="mt-1.5 border-l border-border pl-3">{ts.map((t) => <TaskRow key={t.id} task={t} dense />)}</ul>}
      </li>
    );
  };
  return (
    <div className={cn(pending && "opacity-70")}>
      <form key={formKey} onSubmit={add} className="mb-3 flex flex-wrap gap-2" noValidate>
        <Input name="title" placeholder="New milestone…" aria-label="Milestone title" className="h-8 min-w-[180px] flex-1 py-1 text-[13px]" maxLength={200} />
        <Input name="due_date" type="date" aria-label="Milestone due date" className="h-8 w-auto py-1 text-[13px]" />
        <Button type="submit" size="sm" variant="primary" loading={pending}><Plus />Add</Button>
      </form>
      {error && <p className="mb-2 text-sm text-danger" role="alert">{error}</p>}
      {milestones.length === 0 ? <EmptyState title="No milestones yet">Break the project into checkpoints. Milestone dates show on your calendar and in reminders.</EmptyState> : (
        <>
          <ul className="space-y-2">{open.map((m) => <M key={m.id} m={m} />)}</ul>
          {done.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 eyebrow">Completed milestones · {done.length}</p>
              <ul className="space-y-2 opacity-75">{done.map((m) => <M key={m.id} m={m} />)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PatchForm({ id, children, label = "Save" }: { id: string; children: React.ReactNode; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    const outcome: Record<string, string> = {};
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) {
      if (k.startsWith("outcome.")) outcome[k.slice(8)] = v;
      else patch[k] = v === "" ? null : v;
    }
    if (Object.keys(outcome).length) patch.outcome = outcome;
    start(async () => {
      const r = await patchProjectAction(id, patch);
      if (!r.ok) return setError(r.error);
      setError(null);
      toast.success("Saved");
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {children}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex justify-end"><Button type="submit" size="sm" variant="primary" loading={pending}><Save />{label}</Button></div>
    </form>
  );
}

export function NotesForm({ project }: { project: Project }) {
  return (
    <PatchForm id={project.id} label="Save notes">
      <Field label="Blockers" htmlFor="n-block"><Textarea id="n-block" name="blockers" defaultValue={project.blockers ?? ""} className="min-h-[60px]" placeholder="What's in the way?" /></Field>
      <Field label="Notes" htmlFor="n-notes"><Textarea id="n-notes" name="notes" defaultValue={project.notes ?? ""} placeholder="Personal notes — GitHub sync never touches these." /></Field>
    </PatchForm>
  );
}

export function DemoForm({ project }: { project: Project }) {
  return (
    <PatchForm id={project.id} label="Save links">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Live deployment" htmlFor="dm-demo"><Input id="dm-demo" name="demo_url" type="url" defaultValue={project.demo_url ?? ""} placeholder="https://" /></Field>
        <Field label="Demo video" htmlFor="dm-video"><Input id="dm-video" name="video_url" type="url" defaultValue={project.video_url ?? ""} placeholder="https://" /></Field>
        <Field label="Presentation" htmlFor="dm-pres"><Input id="dm-pres" name="presentation_url" type="url" defaultValue={project.presentation_url ?? ""} placeholder="https://" /></Field>
      </div>
    </PatchForm>
  );
}

export function DocsForm({ project }: { project: Project }) {
  return (
    <PatchForm id={project.id} label="Save">
      <Field label="Project documentation URL" htmlFor="doc-url"><Input id="doc-url" name="docs_url" type="url" defaultValue={project.docs_url ?? ""} placeholder="https://" /></Field>
    </PatchForm>
  );
}

export function OutcomeForm({ project }: { project: Project }) {
  const o = project.outcome ?? {};
  return (
    <PatchForm id={project.id} label="Save outcomes">
      <Field label="Project summary" htmlFor="po-sum"><Textarea id="po-sum" name="outcome.summary" defaultValue={o.summary ?? ""} placeholder="One paragraph you could paste into a resume or portfolio." /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Final tech stack" htmlFor="po-stack"><Input id="po-stack" name="outcome.final_stack" defaultValue={o.final_stack ?? project.tech_stack.join(", ")} /></Field>
        <Field label="Key features" htmlFor="po-feat"><Input id="po-feat" name="outcome.key_features" defaultValue={o.key_features ?? ""} /></Field>
      </div>
      <Field label="Outcomes & accomplishments" htmlFor="po-acc"><Textarea id="po-acc" name="outcome.accomplishments" defaultValue={o.accomplishments ?? ""} className="min-h-[60px]" placeholder="Users, metrics, awards, what you learned" /></Field>
    </PatchForm>
  );
}

export function GithubPanel({ project, snapshot, tokenConfigured }: { project: Project; snapshot: GithubSnapshot | null; tokenConfigured: boolean }) {
  const app = useApp();
  const [pending, start] = useTransition();
  const [analysing, startAnalyse] = useTransition();
  const [adding, startAdd] = useTransition();
  const sync = () => start(async () => {
    const r = await syncGithubAction(project.id);
    if (!r.ok) toast.error(r.error);
    else if (!r.data.ok) toast.error(`GitHub sync failed: ${r.data.error}`);
    else toast.success("Synced from GitHub");
  });
  if (!project.repo_url)
    return <EmptyState icon={GitBranch} title="No repository linked">Add a github.com URL with “Edit” to see repository details. The project works fine without one.</EmptyState>;
  const d = snapshot?.data;
  const a = d?.analysis;
  const analyse = () => startAnalyse(async () => {
    const r = await analyzeProjectAction(project.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Analysis updated", { description: r.data.updated.length ? `Updated: ${r.data.updated.join(", ")}` : "Your own edits were kept" });
  });
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-accent/25 bg-accent/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <h3 className="text-sm font-semibold">AI analysis</h3>
          {a && <span className="text-2xs text-subtle">{fmt.instant(a.analyzed_at, app.tz)} · {a.model}{a.pushed_at && d?.pushed_at && a.pushed_at !== d.pushed_at ? " · new commits since" : ""}</span>}
          <Button size="sm" variant={a ? "secondary" : "primary"} className="ml-auto" loading={analysing} onClick={analyse} disabled={!app.integrations.ai}>
            <Sparkles />{a ? "Re-analyse" : "Analyse repository"}
          </Button>
        </div>
        {!app.integrations.ai && <p className="mt-2 text-2xs text-warn">Add GEMINI_API_KEY to enable analysis.</p>}
        {d?.analysis_error && !analysing && <p className="mt-2 text-2xs text-warn">Last attempt: {d.analysis_error}</p>}
        {analysing && <p className="mt-2 text-2xs text-subtle">Reading README, file tree, commits and issues — usually 20–60s…</p>}
        {a ? (
          <div className="mt-3 space-y-3">
            <p className="text-[13.5px] leading-relaxed">{a.summary}</p>
            <div>
              <div className="mb-1 flex items-center justify-between text-2xs"><span className="text-subtle">Estimated completion · {a.status.replace("_", " ")}</span><span className="num text-fg">{a.progress}%</span></div>
              <ProgressBar value={a.progress} label="AI estimated completion" />
              <p className="mt-1 text-2xs text-subtle">{a.progress_reason}</p>
              {project.progress_mode !== "github" && (
                <button className="mt-1 text-2xs text-accent hover:underline" onClick={() => startAnalyse(async () => {
                  const r = await patchProjectAction(project.id, { progress: a.progress });
                  if (r.ok) toast.success(`Progress set to ${a.progress}%`); else toast.error(r.error);
                })}>Use {a.progress}% as this project&apos;s progress</button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 eyebrow">Done</p>
                <ul className="space-y-1">{a.done.map((x) => <li key={x} className="flex gap-1.5 text-[13px]"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />{x}</li>)}</ul>
              </div>
              <div>
                <p className="mb-1 eyebrow">Remaining</p>
                <ul className="space-y-1">{a.remaining.map((x) => <li key={x} className="flex gap-1.5 text-[13px]"><CircleDashed className="mt-0.5 size-3.5 shrink-0 text-subtle" />{x}</li>)}</ul>
                {a.remaining.length > 0 && (
                  <Button size="sm" variant="ghost" className="mt-1 -ml-2" loading={adding} onClick={() => startAdd(async () => {
                    const r = await remainingToMilestonesAction(project.id, a.remaining);
                    if (r.ok) toast.success(r.data ? `Added ${r.data} milestones` : "Those milestones already exist"); else toast.error(r.error);
                  })}><ListPlus />Add as milestones</Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          !analysing && <p className="mt-2 text-[13px] text-muted">Let AI read the repo and fill in the description, tech stack, progress, and what&apos;s done vs. left. Your own edits are never overwritten.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="outline">Source: GitHub API{tokenConfigured ? " · server token" : " · public, unauthenticated"}</Badge>
        <span className="text-2xs text-subtle">{snapshot?.synced_at ? `Last successful sync ${fmt.instant(snapshot.synced_at, app.tz)}` : "Never synced"}</span>
        <Button size="sm" className="ml-auto" loading={pending} onClick={sync}><RefreshCw />{snapshot?.synced_at ? "Refresh" : "Sync now"}</Button>
      </div>
      {snapshot?.last_error && (!snapshot.synced_at || (snapshot.last_error_at ?? "") > snapshot.synced_at) && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">{snapshot.last_error}{d ? " — showing the last successful sync below." : ""}</div>
          <button onClick={sync} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {!d ? (
        !snapshot?.last_error && <p className="text-sm text-muted">Press “Sync now” to fetch repository details.</p>
      ) : (
        <>
          <div className="rounded-md border border-border p-3">
            <a href={d.html_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:underline"><GitBranch className="size-4" />{d.full_name}<ExternalLink className="size-3 opacity-60" /></a>
            {d.description && <p className="mt-1 text-[13px] text-muted">{d.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-subtle">
              <span>Default branch <span className="font-mono text-fg">{d.default_branch}</span></span>
              {d.language && <span>{d.language}</span>}
              <span className="inline-flex items-center gap-1"><Star className="size-3" />{d.stars}</span>
              <span>{d.forks} forks</span>
              <span>{d.open_issues} open issues & PRs</span>
              {d.pushed_at && <span>Last push {fmt.instant(d.pushed_at, app.tz)}</span>}
              {d.private && <Badge>Private</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 eyebrow">Recent commits</p>
              {d.commits.length ? (
                <ul className="space-y-1.5">
                  {d.commits.map((c) => (
                    <li key={c.sha} className="flex items-start gap-2 text-[13px]">
                      <GitCommit className="mt-0.5 size-3.5 shrink-0 text-subtle" />
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:underline"><span className="block truncate">{c.message}</span>
                        <span className="text-2xs text-subtle"><span className="font-mono">{c.sha}</span>{c.author ? ` · ${c.author}` : ""}{c.date ? ` · ${fmt.instant(c.date, app.tz)}` : ""}</span></a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-muted">No commits returned.</p>}
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 eyebrow">Releases</p>
                {d.releases.length ? <ul className="space-y-1">{d.releases.map((r) => <li key={r.tag}><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] hover:underline"><Tag className="size-3.5 text-subtle" />{r.name}</a></li>)}</ul> : <p className="text-[13px] text-muted">No releases.</p>}
              </div>
              <div>
                <p className="mb-1.5 eyebrow">Open issues</p>
                {d.issues.length ? <ul className="space-y-1">{d.issues.map((i) => <li key={i.number}><a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-[13px] hover:underline"><CircleDot className="mt-0.5 size-3.5 shrink-0 text-ok" /><span>#{i.number} {i.title}</span></a></li>)}</ul> : <p className="text-[13px] text-muted">No open issues.</p>}
              </div>
            </div>
          </div>
          <p className="text-2xs text-subtle">GitHub data is stored separately. The AI analysis only fills in your description/objective while you haven't edited them yourself, never touches your notes or milestones, and judges progress from the repo's goals — not commit counts.</p>
        </>
      )}
    </div>
  );
}

export function DeleteProject({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <Confirm
      title={`Delete ${name}?`}
      description="Milestones, GitHub data and files saved to this project are deleted. Tasks are kept and unlinked. To keep it, set status to Completed instead."
      onConfirm={async () => {
        const r = await deleteProjectAction(id);
        if (!r.ok) return toast.error(r.error);
        toast.success("Project deleted");
        router.push("/projects");
      }}
      trigger={<Button size="icon" variant="ghost" aria-label="Delete project"><Trash2 /></Button>}
    />
  );
}

export { ExternalButton };
