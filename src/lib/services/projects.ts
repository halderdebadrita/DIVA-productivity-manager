import "server-only";
import type { Ctx } from "../context";
import type { Milestone, Project } from "../types";
import { parseRepo } from "../integrations/github";
import { syncEntityReminders } from "./reminders";
import { deleteResourcesFor } from "./resources";

export const listProjects = (ctx: Ctx) =>
  ctx.db.select<Project>("projects", { eq: { user_id: ctx.userId } }, { order: [{ column: "updated_at", ascending: false }] });

export async function getProject(ctx: Ctx, id: string) {
  const [p] = await ctx.db.select<Project>("projects", { eq: { id, user_id: ctx.userId } });
  return p ?? null;
}

export const listMilestones = (ctx: Ctx, projectId?: string) =>
  ctx.db.select<Milestone>(
    "project_milestones",
    { eq: projectId ? { user_id: ctx.userId, project_id: projectId } : { user_id: ctx.userId } },
    { order: [{ column: "sort_order" }, { column: "due_date" }, { column: "created_at" }] },
  );

/** Progress is independent from deadlines: either manual, or the share of completed milestones. */
export function effectiveProgress(p: Project, milestones: Milestone[]) {
  if (p.progress_mode !== "milestones") return p.progress;
  const mine = milestones.filter((m) => m.project_id === p.id);
  if (!mine.length) return 0;
  return Math.round((mine.filter((m) => m.status === "done").length / mine.length) * 100);
}

export function nextMilestone(p: Project, milestones: Milestone[]) {
  return milestones
    .filter((m) => m.project_id === p.id && m.status !== "done")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
}

export async function createProject(ctx: Ctx, input: Record<string, unknown>) {
  const [p] = await ctx.db.insert<Project>("projects", { ...input, user_id: ctx.userId });
  await syncEntityReminders(ctx, "project", p.id);
  return p;
}

export async function updateProject(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  const [p] = await ctx.db.update<Project>("projects", { eq: { id, user_id: ctx.userId } }, patch);
  if (!p) throw new Error("Project not found");
  await syncEntityReminders(ctx, "project", id);
  // milestone reminders depend on project status
  for (const m of await listMilestones(ctx, id)) await syncEntityReminders(ctx, "milestone", m.id);
  return p;
}

/** Deletion policy: project, milestones, GitHub snapshot and project resources are removed; tasks are kept and unlinked. */
export async function deleteProject(ctx: Ctx, id: string) {
  const project = await getProject(ctx, id);
  const ms = await listMilestones(ctx, id);
  await deleteResourcesFor(ctx, "project", id);
  await ctx.db.remove("projects", { eq: { id, user_id: ctx.userId } });
  await syncEntityReminders(ctx, "project", id);
  for (const m of ms) await syncEntityReminders(ctx, "milestone", m.id);
  // don't let GitHub auto-import bring a deleted repo back
  const repo = parseRepo(project?.repo_url);
  if (repo) {
    const prefs = ctx.profile.preferences ?? {};
    const ignored = new Set((prefs.github_ignored_repos as string[] | undefined) ?? []);
    ignored.add(repo);
    await ctx.db.update("profiles", { eq: { id: ctx.userId } }, { preferences: { ...prefs, github_ignored_repos: [...ignored] } });
  }
}

export async function createMilestone(ctx: Ctx, projectId: string, input: Record<string, unknown>) {
  if (!(await getProject(ctx, projectId))) throw new Error("Project not found");
  const existing = await listMilestones(ctx, projectId);
  const [m] = await ctx.db.insert<Milestone>("project_milestones", {
    ...input,
    project_id: projectId,
    user_id: ctx.userId,
    sort_order: existing.length,
  });
  await syncEntityReminders(ctx, "milestone", m.id);
  return m;
}

export async function updateMilestone(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  if (patch.status) patch.completed_at = patch.status === "done" ? new Date().toISOString() : null;
  const [m] = await ctx.db.update<Milestone>("project_milestones", { eq: { id, user_id: ctx.userId } }, patch);
  if (!m) throw new Error("Milestone not found");
  await syncEntityReminders(ctx, "milestone", id);
  return m;
}

export async function deleteMilestone(ctx: Ctx, id: string) {
  await ctx.db.remove("project_milestones", { eq: { id, user_id: ctx.userId } });
  await syncEntityReminders(ctx, "milestone", id);
}
