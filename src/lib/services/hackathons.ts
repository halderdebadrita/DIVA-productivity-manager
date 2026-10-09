import "server-only";
import { catBySlug, type Ctx } from "../context";
import { addDays, todayIn } from "../dates";
import type { Hackathon, Task } from "../types";
import { syncEntityReminders } from "./reminders";
import { deleteResourcesFor } from "./resources";
import { createTask } from "./tasks";
import { resolveQuickLinks } from "../quick-links";

export const listHackathons = (ctx: Ctx) =>
  ctx.db.select<Hackathon>("hackathons", { eq: { user_id: ctx.userId } }, { order: [{ column: "start_date" }, { column: "created_at" }] });

export async function getHackathon(ctx: Ctx, id: string) {
  const [h] = await ctx.db.select<Hackathon>("hackathons", { eq: { id, user_id: ctx.userId } });
  return h ?? null;
}

export const certificateKey = (hackathonId: string) => `hackathon:${hackathonId}:certificate`;

/**
 * Certificate follow-up rule (explicit + idempotent):
 *  - The FIRST time a hackathon becomes Completed, a task
 *    "Upload hackathon certificate to LinkedIn — <name>" is created, due 3 calendar
 *    days after the completion date in the user's timezone.
 *  - The task's source_key is unique per hackathon, so retries, double clicks and
 *    re-saving a completed record can never create a second task.
 *  - Reopening and completing again does NOT create or move the follow-up; the
 *    original task (open or done) remains the single follow-up. If the user deleted
 *    that task, completing again creates a fresh one.
 */
export async function ensureCertificateFollowup(ctx: Ctx, h: Hackathon, completedAt: Date) {
  const due = addDays(todayIn(ctx.tz, completedAt), 3);
  const { task, created } = await createTask(ctx, {
    title: `Upload hackathon certificate to LinkedIn — ${h.name}`,
    description: "Auto-created when the hackathon was marked Completed. Add the certificate in the hackathon workspace, then post it on LinkedIn.",
    category_id: catBySlug(ctx, "hackathons").id,
    priority: "high",
    status: "not_started",
    due_date: due,
    due_time: null,
    estimated_minutes: 20,
    project_id: null,
    milestone_id: null,
    test_id: null,
    hackathon_id: h.id,
    link_url: resolveQuickLinks(ctx.profile.preferences?.quick_links).find((l) => l.key === "linkedin")?.url || null,
    email_reminder: "default",
    source: "hackathon_followup",
    source_key: certificateKey(h.id),
  });
  return { task, created };
}

export async function createHackathon(ctx: Ctx, input: Record<string, unknown>) {
  const status = input.status;
  const [h] = await ctx.db.insert<Hackathon>("hackathons", { ...input, status: "registered", user_id: ctx.userId });
  await syncEntityReminders(ctx, "hackathon", h.id);
  if (status && status !== "registered") return (await updateHackathon(ctx, h.id, { status })).hackathon;
  return h;
}

export async function updateHackathon(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  const current = await getHackathon(ctx, id);
  if (!current) throw new Error("Hackathon not found");
  const next: Record<string, unknown> = { ...patch };
  const becameCompleted = patch.status === "completed" && current.status !== "completed";
  const reopened = patch.status && patch.status !== "completed" && current.status === "completed";
  const now = new Date();
  if (becameCompleted) {
    next.completed_at = now.toISOString();
    next.completion_count = (current.completion_count ?? 0) + 1;
  }
  if (reopened) next.completed_at = null;
  const [h] = await ctx.db.update<Hackathon>("hackathons", { eq: { id, user_id: ctx.userId } }, next);
  let followup: { task: Task; created: boolean } | null = null;
  if (becameCompleted) followup = await ensureCertificateFollowup(ctx, h, now);
  await syncEntityReminders(ctx, "hackathon", id);
  return { hackathon: h, followup };
}

/** Deletion policy: hackathon + its resources/files are removed; tasks (incl. the follow-up) are kept, unlinked. */
export async function deleteHackathon(ctx: Ctx, id: string) {
  await deleteResourcesFor(ctx, "hackathon", id);
  await ctx.db.remove("hackathons", { eq: { id, user_id: ctx.userId } });
  await syncEntityReminders(ctx, "hackathon", id);
}
