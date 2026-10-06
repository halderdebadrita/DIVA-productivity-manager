import "server-only";
import type { Ctx } from "../context";
import { PRIORITY_RANK } from "../constants";
import { todayIn } from "../dates";
import { isUnique } from "../db/types";
import type { Task } from "../types";
import type { TaskInput } from "../validation";
import { syncEntityReminders } from "./reminders";

export async function listTasks(ctx: Ctx) {
  return ctx.db.select<Task>("tasks", { eq: { user_id: ctx.userId } }, { order: [{ column: "due_date" }, { column: "created_at" }] });
}

export async function getTask(ctx: Ctx, id: string) {
  const [t] = await ctx.db.select<Task>("tasks", { eq: { user_id: ctx.userId, id } });
  return t ?? null;
}

async function assertOwnedCategory(ctx: Ctx, categoryId: string) {
  if (!ctx.categories.some((c) => c.id === categoryId)) throw new Error("Unknown category");
}

/** Ensures linked project/test/hackathon/milestone belong to the user (RLS does this in Supabase; demo mode checks here). */
async function assertLinks(ctx: Ctx, i: Partial<TaskInput>) {
  const checks: [string | null | undefined, "projects" | "tests" | "hackathons" | "project_milestones"][] = [
    [i.project_id, "projects"],
    [i.test_id, "tests"],
    [i.hackathon_id, "hackathons"],
    [i.milestone_id, "project_milestones"],
  ];
  for (const [id, table] of checks) {
    if (!id) continue;
    const rows = await ctx.db.select(table, { eq: { user_id: ctx.userId, id } });
    if (!rows.length) throw new Error("Linked item no longer exists");
  }
}

export async function createTask(
  ctx: Ctx,
  input: TaskInput & { source?: Task["source"]; source_key?: string | null },
): Promise<{ task: Task; created: boolean }> {
  await assertOwnedCategory(ctx, input.category_id);
  await assertLinks(ctx, input);
  const row = {
    ...input,
    user_id: ctx.userId,
    completed_at: input.status === "done" ? new Date().toISOString() : null,
  };
  try {
    const [task] = await ctx.db.insert<Task>("tasks", row);
    await syncEntityReminders(ctx, "task", task.id);
    return { task, created: true };
  } catch (e) {
    if (isUnique(e) && input.source_key) {
      // Idempotent creation of generated tasks (e.g. hackathon follow-ups).
      const [existing] = await ctx.db.select<Task>("tasks", { eq: { user_id: ctx.userId, source_key: input.source_key } });
      if (existing) return { task: existing, created: false };
    }
    throw e;
  }
}

export async function updateTask(ctx: Ctx, id: string, patch: Partial<TaskInput>) {
  const current = await getTask(ctx, id);
  if (!current) throw new Error("Task not found");
  if (patch.category_id) await assertOwnedCategory(ctx, patch.category_id);
  await assertLinks(ctx, patch);
  const next: Record<string, unknown> = { ...patch };
  if (patch.status && patch.status !== current.status) {
    next.completed_at = patch.status === "done" ? new Date().toISOString() : null;
  }
  const [task] = await ctx.db.update<Task>("tasks", { eq: { id, user_id: ctx.userId } }, next);
  await syncEntityReminders(ctx, "task", id);
  return task;
}

export async function setTaskDone(ctx: Ctx, id: string, done: boolean) {
  return updateTask(ctx, id, { status: done ? "done" : "not_started" });
}

export async function deleteTask(ctx: Ctx, id: string) {
  await ctx.db.remove("tasks", { eq: { id, user_id: ctx.userId } });
  await syncEntityReminders(ctx, "task", id); // resolves + cancels unsent reminders
}

// ---------------------------------------------------------------------------
// Pure helpers used by dashboard and task views
// ---------------------------------------------------------------------------

export const isOverdue = (t: Task, today: string) => t.status !== "done" && !!t.due_date && t.due_date < today;

export function sortByPriorityThenTime(a: Task, b: Task) {
  return (
    (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
    (a.due_time ?? "99").localeCompare(b.due_time ?? "99") ||
    a.title.localeCompare(b.title)
  );
}

export function sortChronological(a: Task, b: Task) {
  return (
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
    (a.due_time ?? "99").localeCompare(b.due_time ?? "99")
  );
}

export function todayBuckets(tasks: Task[], tz: string) {
  const today = todayIn(tz);
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => isOverdue(t, today)).sort(sortChronological);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const todayMain = dueToday.filter((t) => t.priority !== "low").sort(sortByPriorityThenTime);
  const todayOptional = dueToday.filter((t) => t.priority === "low").sort(sortByPriorityThenTime);
  const doneToday = dueToday.filter((t) => t.status === "done").length;
  return { today, overdue, todayMain, todayOptional, dueTodayCount: dueToday.length, doneToday };
}
