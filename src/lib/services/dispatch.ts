import "server-only";
import { buildCtx, DEMO_USER_ID, ensureCategories, type Ctx } from "../context";
import { addDays, todayIn } from "../dates";
import { localDb, localFiles } from "../db/local";
import { supabaseDb, supabaseFiles } from "../db/supabase";
import { env, isEmailConfigured, isSupabaseConfigured } from "../env";
import { renderReminderEmail, sendEmail } from "../integrations/email";
import { supabaseAdmin } from "../supabase/server";
import type { Milestone, Profile, Reminder } from "../types";
import { hrefFor, syncAllReminders } from "./reminders";

export const MAX_ATTEMPTS = 4;
const BACKOFF_MIN = [5, 15, 45, 120];
const STALE_SENDING_MS = 15 * 60 * 1000;

export interface DispatchReport {
  userId: string;
  synced: { inserted: number; updated: number };
  sent: number;
  failed: number;
  skipped: number;
  waiting: number;
  note?: string;
}

/** Sends every due email for one user. Safe to run any number of times concurrently. */
export async function dispatchForUser(ctx: Ctx, now = new Date()): Promise<Omit<DispatchReport, "userId" | "synced">> {
  const report = { sent: 0, failed: 0, skipped: 0, waiting: 0 } as Omit<DispatchReport, "userId" | "synced">;
  const rows = await ctx.db.select<Reminder>("reminders", {
    eq: { user_id: ctx.userId },
    in: { email_status: ["pending", "failed", "sending"] },
    lte: { remind_at: now.toISOString() },
  });
  const nowIso = now.toISOString();
  const due = rows.filter((r) => {
    if (r.email_status === "pending") return true;
    if (r.email_status === "failed") return r.email_attempts < MAX_ATTEMPTS && (!r.next_attempt_at || r.next_attempt_at <= nowIso);
    // a "sending" row older than 15 min was interrupted mid-flight; retry (provider idempotency prevents a double send)
    return now.getTime() - new Date(r.updated_at).getTime() > STALE_SENDING_MS && r.email_attempts < MAX_ATTEMPTS;
  });
  if (!due.length) return report;
  if (!isEmailConfigured()) {
    report.waiting = due.length;
    report.note = "Email provider not configured — reminders stay pending (nothing is marked as sent).";
    return report;
  }
  if (!ctx.reminderEmail) {
    report.waiting = due.length;
    report.note = "No reminder email address configured for this user.";
    return report;
  }
  const yesterday = addDays(todayIn(ctx.tz, now), -1);

  for (const r of due) {
    if (r.in_app_state === "resolved" || r.event_date < yesterday) {
      await ctx.db.update("reminders", { eq: { id: r.id, email_status: r.email_status } }, { email_status: r.in_app_state === "resolved" ? "cancelled" : "skipped" });
      report.skipped++;
      continue;
    }
    // Atomic claim: only one runner can move this row from its current state to "sending".
    const claimed = await ctx.db.update<Reminder>(
      "reminders",
      { eq: { id: r.id, email_status: r.email_status, email_attempts: r.email_attempts } },
      { email_status: "sending", email_attempts: r.email_attempts + 1 },
    );
    if (!claimed.length) continue;
    let projectId: string | undefined;
    if (r.entity_type === "milestone") {
      const [m] = await ctx.db.select<Milestone>("project_milestones", { eq: { id: r.entity_id } });
      projectId = m?.project_id;
    }
    const link = `${env.appUrl}${hrefFor(r.entity_type, r.entity_id, projectId)}`;
    const result = await sendEmail(ctx.reminderEmail, renderReminderEmail(r, link), r.idempotency_key);
    const attempts = r.email_attempts + 1;
    if (result.ok) {
      await ctx.db.update("reminders", { eq: { id: r.id } }, {
        email_status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result.id ?? null,
        last_error: null,
        next_attempt_at: null,
      });
      report.sent++;
    } else {
      const retry = result.transient && attempts < MAX_ATTEMPTS;
      await ctx.db.update("reminders", { eq: { id: r.id } }, {
        email_status: "failed",
        last_error: result.error ?? "Unknown error",
        email_attempts: retry ? attempts : MAX_ATTEMPTS,
        next_attempt_at: retry ? new Date(Date.now() + BACKOFF_MIN[attempts - 1] * 60_000).toISOString() : null,
      });
      report.failed++;
    }
  }
  return report;
}

/** Entry point for the scheduler (cron route / script). */
export async function runReminderJob(now = new Date()): Promise<DispatchReport[]> {
  const reports: DispatchReport[] = [];
  if (isSupabaseConfigured()) {
    const admin = supabaseAdmin();
    const db = supabaseDb(admin);
    const files = supabaseFiles(admin);
    const profiles = await db.select<Profile>("profiles");
    for (const p of profiles) {
      const cats = await ensureCategories(db, p.id);
      const ctx = buildCtx({ db, files, userId: p.id, mode: "supabase" }, p, cats);
      reports.push(await runForCtx(ctx, now));
    }
  } else {
    const db = localDb();
    const [p] = await db.select<Profile>("profiles", { eq: { id: DEMO_USER_ID } });
    if (p) {
      const cats = await ensureCategories(db, p.id);
      reports.push(await runForCtx(buildCtx({ db, files: localFiles(), userId: p.id, mode: "demo" }, p, cats), now));
    }
  }
  return reports;
}

export async function runForCtx(ctx: Ctx, now = new Date()): Promise<DispatchReport> {
  // Keep GitHub-linked projects fresh (metadata every 6h, AI re-analysis only after new pushes).
  try {
    const { autoRefresh } = await import("./github");
    await autoRefresh(ctx, { maxAgeHours: 1, limit: 5 });
  } catch (e) {
    console.error("[github auto-refresh]", e);
  }
  const synced = await syncAllReminders(ctx, now);
  const r = await dispatchForUser(ctx, now);
  return { userId: ctx.userId, synced, ...r };
}

/** Manual retry of a failed email from the UI: puts it back in the queue for the scheduler. */
export async function retryReminder(ctx: Ctx, id: string) {
  await ctx.db.update(
    "reminders",
    { eq: { id, user_id: ctx.userId, email_status: "failed" } },
    { email_status: "pending", email_attempts: 0, next_attempt_at: null, last_error: null },
  );
}
