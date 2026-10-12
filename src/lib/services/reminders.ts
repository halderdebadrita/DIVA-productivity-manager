import "server-only";
import type { Ctx } from "../context";
import { addDays, daysBetween, todayIn, zonedToUtc } from "../dates";
import { isUnique } from "../db/types";
import type { Hackathon, Milestone, Project, Reminder, ReminderEntity, Task, Test } from "../types";

/**
 * Reminder model
 * ---------------
 * Every dated, still-open item (task, test, project deadline, milestone, hackathon
 * submission) gets one reminder row per "offset" (days before the event), plus a
 * day-of row that always exists for the in-app panel. The same rows drive email:
 *   email_status = pending → (cron) sending → sent | failed (retried with backoff)
 *   cancelled  = the item was completed / rescheduled / deleted before sending
 *   skipped    = email not wanted for this row (prefs, task opted out, or superseded)
 * Rows are keyed by a stable idempotency_key (unique in the DB) so repeated syncs
 * and repeated scheduler runs can never create or send duplicates.
 *
 * Cancellation policy: completing / deleting / rescheduling an item cancels its
 * unsent emails and resolves its in-app reminders. Reopening re-activates future
 * reminders; past-due ones are not re-sent except one catch-up for today's event.
 */

interface Desired {
  key: string;
  entity_type: ReminderEntity;
  entity_id: string;
  reminder_type: string;
  title: string;
  event_date: string;
  event_time: string | null;
  offset_days: number;
  remind_at: Date;
  priority: string;
  category_slug: string | null;
  emailWanted: boolean;
}

interface Entities {
  tasks: Task[];
  tests: Test[];
  projects: Project[];
  milestones: Milestone[];
  hackathons: Hackathon[];
}

function remindAt(ctx: Ctx, eventDate: string, eventTime: string | null, offset: number) {
  const day = addDays(eventDate, -offset);
  const hour = String(ctx.prefs.send_hour).padStart(2, "0");
  let time = `${hour}:00`;
  if (offset === 0 && eventTime && eventTime <= time) {
    // Event earlier than the usual send hour: remind one hour before it.
    const [h, m] = eventTime.split(":").map(Number);
    time = `${String(Math.max(0, h - 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return zonedToUtc(day, time, ctx.tz);
}

function expand(
  ctx: Ctx,
  base: Omit<Desired, "key" | "offset_days" | "remind_at" | "emailWanted">,
  offsets: number[],
  emailAllowed: boolean,
): Desired[] {
  const all = Array.from(new Set([0, ...offsets])).sort((a, b) => b - a);
  return all.map((d) => ({
    ...base,
    offset_days: d,
    remind_at: remindAt(ctx, base.event_date, base.event_time, d),
    emailWanted: emailAllowed && offsets.includes(d),
    key: `${ctx.userId}:${base.entity_type}:${base.entity_id}:${base.event_date}:${base.event_time ?? ""}:${d}`,
  }));
}

function desiredFor(ctx: Ctx, e: Entities): Desired[] {
  const today = todayIn(ctx.tz);
  const catSlug = (id: string) => ctx.categories.find((c) => c.id === id)?.slug ?? "other";
  const projectName = (id: string) => e.projects.find((p) => p.id === id)?.name ?? "Project";
  const out: Desired[] = [];

  for (const t of e.tasks) {
    if (!t.due_date || t.status === "done") continue;
    const followup = t.source === "hackathon_followup";
    out.push(
      ...expand(
        ctx,
        {
          entity_type: "task",
          entity_id: t.id,
          reminder_type: followup ? "certificate_followup" : "task_due",
          title: t.title,
          event_date: t.due_date,
          event_time: t.due_time,
          priority: t.priority,
          category_slug: catSlug(t.category_id),
        },
        followup ? ctx.prefs.followup_offsets : ctx.prefs.task_offsets,
        t.email_reminder !== "off",
      ),
    );
  }
  for (const t of e.tests) {
    if (t.test_date < today) continue; // past tests stop reminding
    out.push(
      ...expand(
        ctx,
        {
          entity_type: "test",
          entity_id: t.id,
          reminder_type: "test",
          title: `${t.type === "practical" ? "Practical" : "Theory"} test: ${t.name}`,
          event_date: t.test_date,
          event_time: t.test_time,
          priority: "high",
          category_slug: "tests",
        },
        ctx.prefs.test_offsets,
        true,
      ),
    );
  }
  for (const p of e.projects) {
    if (!p.deadline || p.status === "completed") continue;
    out.push(
      ...expand(
        ctx,
        {
          entity_type: "project",
          entity_id: p.id,
          reminder_type: "project_deadline",
          title: `Project deadline: ${p.name}`,
          event_date: p.deadline,
          event_time: null,
          priority: "high",
          category_slug: "projects",
        },
        ctx.prefs.project_offsets,
        true,
      ),
    );
  }
  for (const m of e.milestones) {
    if (!m.due_date || m.status === "done") continue;
    const parent = e.projects.find((p) => p.id === m.project_id);
    if (parent?.status === "completed") continue;
    out.push(
      ...expand(
        ctx,
        {
          entity_type: "milestone",
          entity_id: m.id,
          reminder_type: "milestone",
          title: `Milestone: ${m.title} · ${projectName(m.project_id)}`,
          event_date: m.due_date,
          event_time: null,
          priority: "medium",
          category_slug: "projects",
        },
        ctx.prefs.task_offsets,
        true,
      ),
    );
  }
  for (const h of e.hackathons) {
    if (!h.submission_deadline || h.status === "submitted" || h.status === "completed") continue;
    out.push(
      ...expand(
        ctx,
        {
          entity_type: "hackathon",
          entity_id: h.id,
          reminder_type: "hackathon_submission",
          title: `Submission due: ${h.name}`,
          event_date: h.submission_deadline,
          event_time: h.submission_time,
          priority: "urgent",
          category_slug: "hackathons",
        },
        ctx.prefs.hackathon_offsets,
        true,
      ),
    );
  }
  return out;
}

/** Which past-due desired rows should still send one catch-up email (latest per entity, event not passed). */
function catchUpKeys(ctx: Ctx, desired: Desired[], now: Date) {
  const today = todayIn(ctx.tz, now);
  const best = new Map<string, Desired>();
  for (const d of desired) {
    if (!d.emailWanted || d.remind_at > now || d.event_date < today) continue;
    const id = `${d.entity_type}:${d.entity_id}`;
    const cur = best.get(id);
    if (!cur || d.remind_at > cur.remind_at) best.set(id, d);
  }
  return new Set([...best.values()].map((d) => d.key));
}

async function loadEntities(ctx: Ctx, scope?: { type: ReminderEntity; id: string }): Promise<Entities> {
  const u = { user_id: ctx.userId };
  const only = (t: ReminderEntity) => (scope ? scope.type === t : true);
  const byId = (t: ReminderEntity) => (scope && scope.type === t ? { ...u, id: scope.id } : u);
  const [tasks, tests, projects, milestones, hackathons] = await Promise.all([
    only("task") ? ctx.db.select<Task>("tasks", { eq: byId("task") }) : [],
    only("test") ? ctx.db.select<Test>("tests", { eq: byId("test") }) : [],
    // projects are needed for milestone titles too
    only("project") || only("milestone") ? ctx.db.select<Project>("projects", { eq: byId("project") }) : [],
    only("milestone") ? ctx.db.select<Milestone>("project_milestones", { eq: byId("milestone") }) : [],
    only("hackathon") ? ctx.db.select<Hackathon>("hackathons", { eq: byId("hackathon") }) : [],
  ]);
  if (scope?.type === "milestone" && milestones[0]) {
    const p = await ctx.db.select<Project>("projects", { eq: { ...u, id: milestones[0].project_id } });
    return { tasks, tests, projects: p, milestones, hackathons };
  }
  return { tasks, tests, projects, milestones, hackathons };
}

async function reconcile(ctx: Ctx, desired: Desired[], existing: Reminder[], now = new Date()) {
  const emailGlobal = ctx.prefs.email_enabled;
  const catchUp = catchUpKeys(ctx, desired, now);
  const desiredKeys = new Set(desired.map((d) => d.key));
  const byKey = new Map(existing.map((r) => [r.idempotency_key, r]));
  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  for (const d of desired) {
    const emailOn = emailGlobal && d.emailWanted;
    const future = d.remind_at > now;
    const ex = byKey.get(d.key);
    if (!ex) {
      inserts.push({
        user_id: ctx.userId,
        entity_type: d.entity_type,
        entity_id: d.entity_id,
        reminder_type: d.reminder_type,
        title: d.title,
        event_date: d.event_date,
        event_time: d.event_time,
        offset_days: d.offset_days,
        remind_at: d.remind_at.toISOString(),
        timezone: ctx.tz,
        priority: d.priority,
        category_slug: d.category_slug,
        in_app_state: "active",
        email_status: emailOn && (future || catchUp.has(d.key)) ? "pending" : "skipped",
        idempotency_key: d.key,
      });
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (ex.title !== d.title) patch.title = d.title;
    if (ex.priority !== d.priority) patch.priority = d.priority;
    if (ex.category_slug !== d.category_slug) patch.category_slug = d.category_slug;
    if (ex.in_app_state === "resolved") patch.in_app_state = "active";
    if (ex.remind_at !== d.remind_at.toISOString() && !ex.sent_at && ex.email_status !== "sending") {
      patch.remind_at = d.remind_at.toISOString(); // send hour changed
    }
    if (!ex.sent_at && ex.email_status !== "sending") {
      if ((ex.email_status === "pending" || ex.email_status === "failed") && !emailOn) patch.email_status = "cancelled";
      if ((ex.email_status === "cancelled" || ex.email_status === "skipped") && emailOn) {
        if (future) patch.email_status = "pending";
        else if (ex.email_status === "cancelled" && catchUp.has(d.key)) patch.email_status = "pending";
      }
      if (patch.email_status === "pending") {
        patch.email_attempts = 0;
        patch.next_attempt_at = null;
        patch.last_error = null;
      }
    }
    if (Object.keys(patch).length) updates.push({ id: ex.id, patch });
  }

  for (const ex of existing) {
    if (desiredKeys.has(ex.idempotency_key)) continue;
    const patch: Record<string, unknown> = {};
    if (ex.in_app_state !== "resolved") patch.in_app_state = "resolved";
    if (ex.email_status === "pending" || ex.email_status === "failed") patch.email_status = "cancelled";
    if (Object.keys(patch).length) updates.push({ id: ex.id, patch });
  }

  if (inserts.length) {
    try {
      await ctx.db.insert("reminders", inserts);
    } catch (e) {
      if (!isUnique(e)) throw e;
      // Lost a race with a concurrent sync: insert one by one, ignoring existing keys.
      for (const row of inserts) {
        try {
          await ctx.db.insert("reminders", row);
        } catch (err) {
          if (!isUnique(err)) throw err;
        }
      }
    }
  }
  for (const u of updates) {
    // never touch a row the dispatcher is currently sending
    await ctx.db.update("reminders", { eq: { id: u.id, user_id: ctx.userId } }, u.patch);
  }
  return { inserted: inserts.length, updated: updates.length };
}

/** Re-derive reminders for one item after it was created/edited/completed/deleted. */
export async function syncEntityReminders(ctx: Ctx, type: ReminderEntity, id: string) {
  const entities = await loadEntities(ctx, { type, id });
  const desired = desiredFor(ctx, entities).filter((d) => d.entity_type === type && d.entity_id === id);
  const existing = await ctx.db.select<Reminder>("reminders", { eq: { user_id: ctx.userId, entity_type: type, entity_id: id } });
  return reconcile(ctx, desired, existing);
}

/** Full re-derivation (scheduler + preference changes). */
export async function syncAllReminders(ctx: Ctx, now = new Date()) {
  const entities = await loadEntities(ctx);
  const desired = desiredFor(ctx, entities);
  const existing = await ctx.db.select<Reminder>("reminders", { eq: { user_id: ctx.userId } });
  return reconcile(ctx, desired, existing, now);
}

// ---------------------------------------------------------------------------
// Dashboard panel (reads the same rows)
// ---------------------------------------------------------------------------

export interface PanelItem {
  groupKey: string;
  entity_type: ReminderEntity;
  entity_id: string;
  reminder_type: string;
  title: string;
  event_date: string;
  event_time: string | null;
  priority: string;
  category_slug: string | null;
  bucket: "overdue" | "today" | "soon" | "later";
  href: string;
  projectId?: string;
  email: { status: string; sent: number; pending: number; failed: number; nextAt: string | null; lastSentAt: string | null; lastError: string | null };
}

export async function reminderPanel(ctx: Ctx, extra?: { milestoneProject?: Map<string, string> }) {
  const today = todayIn(ctx.tz);
  const rows = await ctx.db.select<Reminder>("reminders", { eq: { user_id: ctx.userId, in_app_state: "active" } });
  const groups = new Map<string, Reminder[]>();
  for (const r of rows) {
    if (r.entity_type !== "task" && r.event_date < today) continue; // non-task events vanish once passed
    const k = `${r.entity_type}:${r.entity_id}:${r.event_date}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const items: PanelItem[] = [];
  for (const [k, rs] of groups) {
    const r = rs[0];
    const diff = daysBetween(today, r.event_date);
    const sent = rs.filter((x) => x.email_status === "sent").sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
    const pending = rs.filter((x) => x.email_status === "pending").sort((a, b) => a.remind_at.localeCompare(b.remind_at));
    const failed = rs.filter((x) => x.email_status === "failed");
    const status = failed.length ? "failed" : pending.length ? "pending" : sent.length ? "sent" : rs.some((x) => x.email_status === "sending") ? "sending" : "off";
    const projectId = r.entity_type === "milestone" ? extra?.milestoneProject?.get(r.entity_id) : undefined;
    items.push({
      groupKey: k,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      reminder_type: r.reminder_type,
      title: r.title,
      event_date: r.event_date,
      event_time: r.event_time,
      priority: r.priority,
      category_slug: r.category_slug,
      bucket: diff < 0 ? "overdue" : diff === 0 ? "today" : diff <= 7 ? "soon" : "later",
      href: hrefFor(r.entity_type, r.entity_id, projectId),
      projectId,
      email: {
        status,
        sent: sent.length,
        pending: pending.length,
        failed: failed.length,
        nextAt: pending[0]?.remind_at ?? null,
        lastSentAt: sent[0]?.sent_at ?? null,
        lastError: failed[0]?.last_error ?? null,
      },
    });
  }
  const rank = { overdue: 0, today: 1, soon: 2, later: 3 } as const;
  const prio: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  items.sort(
    (a, b) =>
      rank[a.bucket] - rank[b.bucket] ||
      a.event_date.localeCompare(b.event_date) ||
      (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2),
  );
  return items;
}

export function hrefFor(type: ReminderEntity, id: string, projectId?: string) {
  switch (type) {
    case "task":
      return `/tasks?task=${id}`;
    case "test":
      return `/tests#test-${id}`;
    case "project":
      return `/projects/${id}`;
    case "milestone":
      return projectId ? `/projects/${projectId}?tab=tasks` : `/projects`;
    case "hackathon":
      return `/hackathons/${id}`;
  }
}

export async function acknowledgeReminder(ctx: Ctx, entityType: ReminderEntity, entityId: string, eventDate: string) {
  await ctx.db.update(
    "reminders",
    { eq: { user_id: ctx.userId, entity_type: entityType, entity_id: entityId, event_date: eventDate, in_app_state: "active" } },
    { in_app_state: "acknowledged" },
  );
}

export async function deliveryLog(ctx: Ctx, limit = 30) {
  const rows = await ctx.db.select<Reminder>("reminders", { eq: { user_id: ctx.userId } });
  const relevant = rows.filter((r) => ["sent", "failed", "sending", "pending"].includes(r.email_status));
  const now = new Date().toISOString();
  return {
    recent: relevant
      .filter((r) => r.email_status !== "pending")
      .sort((a, b) => (b.sent_at ?? b.updated_at).localeCompare(a.sent_at ?? a.updated_at))
      .slice(0, limit),
    upcoming: relevant
      .filter((r) => r.email_status === "pending")
      .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
      .slice(0, limit),
    dueNow: relevant.filter((r) => r.email_status === "pending" && r.remind_at <= now).length,
  };
}
