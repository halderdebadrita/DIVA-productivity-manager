import "server-only";
import { z } from "zod";
import type { Ctx } from "../context";
import { fetchRepo, fetchRepoContext, githubUserFromUrl, listRepos, parseRepo, type RepoContext } from "../integrations/github";
import { generateJSON } from "../integrations/ai";
import { isAIConfigured } from "../env";
import { resolveQuickLinks } from "../quick-links";
import type { GithubAnalysis, GithubData, GithubSnapshot, Project } from "../types";
import { createMilestone, createProject, getProject, listProjects, updateProject } from "./projects";

export async function getSnapshot(ctx: Ctx, projectId: string) {
  const [s] = await ctx.db.select<GithubSnapshot>("github_snapshots", { eq: { project_id: projectId, user_id: ctx.userId } });
  return s ?? null;
}

async function saveSnapshot(ctx: Ctx, projectId: string, existing: GithubSnapshot | null, row: Record<string, unknown>) {
  if (existing) await ctx.db.update("github_snapshots", { eq: { project_id: projectId, user_id: ctx.userId } }, row);
  else await ctx.db.insert("github_snapshots", { ...row, project_id: projectId, user_id: ctx.userId });
}

/** Refreshes repository metadata. Keeps the last AI analysis and never touches your own notes. */
export async function syncGithub(ctx: Ctx, projectId: string) {
  const project = await getProject(ctx, projectId);
  if (!project) throw new Error("Project not found");
  const full = parseRepo(project.repo_url);
  if (!full) throw new Error("Add a github.com repository URL to this project first");
  const existing = await getSnapshot(ctx, projectId);
  const now = new Date().toISOString();
  try {
    const data = await fetchRepo(full);
    await saveSnapshot(ctx, projectId, existing, { repo_full_name: full, data: { ...existing?.data, ...data, analysis: existing?.data?.analysis ?? null }, synced_at: now, last_error: null, last_error_at: null });
    return { ok: true as const, pushedAt: data.pushed_at };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await saveSnapshot(ctx, projectId, existing, { repo_full_name: full, last_error: msg, last_error_at: now });
    return { ok: false as const, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Your repositories
// ---------------------------------------------------------------------------

export function githubUsername(ctx: Ctx) {
  const url = resolveQuickLinks(ctx.profile.preferences?.quick_links).find((l) => l.key === "github")?.url;
  return githubUserFromUrl(url);
}

export async function myRepos(ctx: Ctx) {
  const [{ login, repos, includesPrivate }, projects] = await Promise.all([listRepos(githubUsername(ctx)), listProjects(ctx)]);
  const linked = new Map(projects.map((p) => [parseRepo(p.repo_url)?.toLowerCase(), p.id]));
  return {
    login,
    includesPrivate,
    repos: repos.map((r) => ({ ...r, projectId: linked.get(r.full_name.toLowerCase()) ?? null })),
  };
}

const prettyName = (repo: string) => repo.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Creates one project per selected repo (skips ones already linked). Progress is driven by GitHub analysis. */
export async function importRepos(ctx: Ctx, fullNames: string[]) {
  const { repos } = await myRepos(ctx);
  const created: { id: string; name: string }[] = [];
  for (const full of fullNames.slice(0, 50)) {
    const r = repos.find((x) => x.full_name.toLowerCase() === full.toLowerCase());
    if (!r || r.projectId) continue;
    const recent = r.pushed_at && Date.now() - new Date(r.pushed_at).getTime() < 30 * 864e5;
    const p = await createProject(ctx, {
      name: prettyName(r.name),
      description: r.description,
      objective: null,
      tech_stack: r.language ? [r.language] : [],
      status: r.archived ? "completed" : recent ? "in_progress" : "paused",
      progress: r.archived ? 100 : 0,
      progress_mode: "github",
      start_date: r.created_at?.slice(0, 10) ?? null,
      deadline: null,
      repo_url: r.html_url,
      demo_url: r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null,
      presentation_url: null,
      docs_url: null,
      video_url: null,
    });
    created.push({ id: p.id, name: p.name });
  }
  return created;
}

// ---------------------------------------------------------------------------
// AI analysis: what's done, what's left, how far along
// ---------------------------------------------------------------------------

const analysisSchema = z.object({
  summary: z.string().min(20).max(600),
  objective: z.string().min(5).max(300),
  tech_stack: z.array(z.string().min(1).max(40)).max(12),
  status: z.enum(["planning", "in_progress", "paused", "completed"]),
  progress: z.number().int().min(0).max(100),
  progress_reason: z.string().min(5).max(400),
  done: z.array(z.string().min(2).max(160)).max(12),
  remaining: z.array(z.string().min(2).max(160)).max(12),
});

const SYSTEM = `You review a student's GitHub repository and report its real state for a personal project tracker.
Use only the evidence given (README, file tree, dependencies, commit history, issues). Do not invent features.
Return ONLY JSON:
{"summary": 2-3 plain sentences: what the project is and what it currently does,
 "objective": one sentence: the goal / problem it solves,
 "tech_stack": main languages/frameworks/services actually used (max 10),
 "status": "planning" (little code yet) | "in_progress" (active work) | "paused" (no commits for 2+ months, unfinished) | "completed" (goals met / shipped),
 "progress": integer 0-100 = share of the project's OWN stated goals (README goals, roadmap, TODOs, open issues) that are implemented. Never base it on commit counts or file counts. If the README states no goals, judge against what a reasonable MVP of the described idea needs,
 "progress_reason": 1-2 sentences justifying the number,
 "done": implemented features/parts (short phrases, max 10),
 "remaining": concrete missing pieces / next steps (short imperative phrases, max 8)}`;

function contextPrompt(c: RepoContext, today: string) {
  const langs = Object.entries(c.data.languages ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k).join(", ");
  return [
    `Today: ${today}`,
    `Repository: ${c.data.full_name}${c.data.private ? " (private)" : ""}`,
    `Description: ${c.data.description ?? "—"}`,
    `Homepage: ${c.data.homepage ?? "—"} · Topics: ${(c.data.topics ?? []).join(", ") || "—"}`,
    `Languages: ${langs || "—"} · Created: ${c.data.created_at?.slice(0, 10) ?? "?"} · Last push: ${c.data.pushed_at?.slice(0, 10) ?? "?"}`,
    `Open issues (${c.issueTitles.open.length}): ${c.issueTitles.open.join(" | ") || "none"} · Closed issues: ${c.issueTitles.closedCount}`,
    `Recent commits (newest first):\n${c.commitLog.slice(0, 40).join("\n") || "none"}`,
    `File tree (${c.tree.length} paths shown):\n${c.tree.join("\n")}`,
    c.packageJson ? `package.json:\n${c.packageJson}` : "",
    `README:\n${c.readme ?? "(no README)"}`,
  ].join("\n\n").slice(0, 28000);
}

/**
 * Syncs the repo, asks the AI what's done/left, stores the analysis, and keeps the project
 * up to date: description/objective are only (re)written if empty or still the last AI text
 * (your own edits are never overwritten); progress is set when the project tracks "From GitHub".
 */
export async function analyzeProject(ctx: Ctx, projectId: string) {
  const project = await getProject(ctx, projectId);
  if (!project) throw new Error("Project not found");
  const full = parseRepo(project.repo_url);
  if (!full) throw new Error("Add a github.com repository URL to this project first");
  if (!isAIConfigured()) throw new Error("AI isn't configured — add GEMINI_API_KEY to analyse repositories");
  const existing = await getSnapshot(ctx, projectId);
  let c: RepoContext;
  try {
    c = await fetchRepoContext(full);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't read the repository";
    await saveSnapshot(ctx, projectId, existing, { repo_full_name: full, last_error: msg, last_error_at: new Date().toISOString() });
    throw new Error(msg);
  }
  const { todayIn } = await import("../dates");
  let a: z.infer<typeof analysisSchema>;
  let model: string;
  try {
    ({ data: a, model } = await generateJSON(analysisSchema, SYSTEM, contextPrompt(c, todayIn(ctx.tz)), 1800));
  } catch (e) {
    // remember the failure so automatic refreshes back off instead of burning AI quota
    const msg = e instanceof Error ? e.message : "Analysis failed";
    await saveSnapshot(ctx, projectId, existing, {
      repo_full_name: full,
      data: { ...existing?.data, ...c.data, analysis: existing?.data?.analysis ?? null, analysis_error: friendlyAIError(msg), analysis_error_at: new Date().toISOString() },
      synced_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    });
    throw new Error(friendlyAIError(msg));
  }

  const prev = existing?.data?.analysis;
  const patch: Record<string, unknown> = {};
  const applied: GithubAnalysis["applied"] = { ...(prev?.applied ?? {}) };
  // "untouched" = empty, still the last AI text, or just GitHub's own one-line repo description
  const untouched = (current: string | null, lastAi?: string) =>
    !current?.trim() || (lastAi && current === lastAi) || (c.data.description && current.trim() === c.data.description.trim());
  if (untouched(project.description, prev?.applied.description)) {
    patch.description = a.summary;
    applied.description = a.summary;
  }
  if (untouched(project.objective, prev?.applied.objective)) {
    patch.objective = a.objective;
    applied.objective = a.objective;
  }
  if (!project.tech_stack.length || (project.tech_stack.length === 1 && project.progress_mode === "github")) patch.tech_stack = a.tech_stack;
  if (project.progress_mode === "github") {
    patch.progress = a.progress;
    if (project.status !== "completed" || a.status === "completed") patch.status = a.status;
  }
  if (!project.demo_url && c.data.homepage && /^https?:\/\//.test(c.data.homepage)) patch.demo_url = c.data.homepage;

  const analysis: GithubAnalysis = { ...a, analyzed_at: new Date().toISOString(), pushed_at: c.data.pushed_at, model, applied };
  const data: GithubData = { ...c.data, analysis, analysis_error: null, analysis_error_at: null };
  await saveSnapshot(ctx, projectId, existing, { repo_full_name: full, data, synced_at: analysis.analyzed_at, last_error: null, last_error_at: null });
  if (Object.keys(patch).length) await updateProject(ctx, projectId, patch);
  return { analysis, updated: Object.keys(patch) };
}

/** Turns the AI's "remaining" list into real milestones (skips ones that already exist). */
export async function remainingToMilestones(ctx: Ctx, projectId: string, items: string[]) {
  const { listMilestones } = await import("./projects");
  const existing = new Set((await listMilestones(ctx, projectId)).map((m) => m.title.toLowerCase().trim()));
  let n = 0;
  for (const title of items.slice(0, 12)) {
    const t = title.trim().slice(0, 200);
    if (!t || existing.has(t.toLowerCase())) continue;
    await createMilestone(ctx, projectId, { title: t, description: "Suggested from GitHub analysis", due_date: null });
    n++;
  }
  return n;
}

/** Repos whose project you deleted — auto-import leaves them alone. */
export const ignoredRepos = (ctx: Ctx) =>
  new Set(((ctx.profile.preferences?.github_ignored_repos as string[] | undefined) ?? []).map((r) => r.toLowerCase()));

/** Adds a project for every repo you own that isn't in Diva yet (skips forks, archived and ignored repos). */
export async function autoImportNewRepos(ctx: Ctx) {
  const { repos } = await myRepos(ctx);
  const ignored = ignoredRepos(ctx);
  const fresh = repos.filter((r) => !r.projectId && !r.fork && !r.archived && !ignored.has(r.full_name.toLowerCase()));
  return fresh.length ? importRepos(ctx, fresh.map((r) => r.full_name)) : [];
}

/**
 * Keeps GitHub projects fresh without wasting AI calls: re-syncs metadata when it's
 * older than `maxAgeHours`, and re-analyses only when the repo has new pushes since
 * the last analysis. Used on page visits and by the scheduled job.
 */
export async function autoRefresh(ctx: Ctx, opts: { maxAgeHours?: number; limit?: number; projectId?: string } = {}) {
  const maxAge = (opts.maxAgeHours ?? 6) * 3600e3;
  const report = { imported: 0, synced: 0, analysed: 0, errors: [] as string[] };
  if (!opts.projectId) {
    try {
      report.imported = (await autoImportNewRepos(ctx)).length;
    } catch (e) {
      report.errors.push(`Import: ${e instanceof Error ? e.message : "couldn't list repositories"}`);
    }
  }
  const projects = (await listProjects(ctx)).filter((p) => parseRepo(p.repo_url) && (!opts.projectId || p.id === opts.projectId));
  // stalest first, so every project gets its turn even when there are more than `limit`
  const snaps = new Map(await Promise.all(projects.map(async (p) => [p.id, await getSnapshot(ctx, p.id)] as const)));
  const syncedAt = (id: string) => (snaps.get(id)?.synced_at ? new Date(snaps.get(id)!.synced_at!).getTime() : 0);
  projects.sort((a, b) => syncedAt(a.id) - syncedAt(b.id));
  for (const p of projects.slice(0, opts.limit ?? 10)) {
    const snap = snaps.get(p.id) ?? null;
    const stale = !snap?.synced_at || Date.now() - new Date(snap.synced_at).getTime() > maxAge;
    let pushedAt = snap?.data?.pushed_at ?? null;
    if (stale) {
      const r = await syncGithub(ctx, p.id);
      if (!r.ok) {
        report.errors.push(`${p.name}: ${r.error}`);
        continue;
      }
      pushedAt = r.pushedAt;
      report.synced++;
    }
    const fresh = (await getSnapshot(ctx, p.id))?.data;
    const analysis = fresh?.analysis;
    const recentlyFailed = fresh?.analysis_error_at && Date.now() - new Date(fresh.analysis_error_at).getTime() < 2 * 3600e3;
    const needsAnalysis = isAIConfigured() && !recentlyFailed && (!analysis || (pushedAt && analysis.pushed_at !== pushedAt));
    if (needsAnalysis) {
      try {
        await analyzeProject(ctx, p.id);
        report.analysed++;
      } catch (e) {
        report.errors.push(`${p.name}: ${e instanceof Error ? e.message : "analysis failed"}`);
      }
    }
  }
  return report;
}

export type { Project };

export function friendlyAIError(msg: string) {
  if (/\b429\b/.test(msg) || /quota/i.test(msg)) return "Gemini free-tier limit reached — Diva will retry automatically later (or press Analyse in a few minutes).";
  if (/\b503\b/.test(msg) || /high demand|overloaded/i.test(msg)) return "Gemini is overloaded right now — Diva will retry automatically later.";
  return msg.slice(0, 200);
}
