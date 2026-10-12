import "server-only";
import { env, isEmailConfigured } from "../env";
import { daysBetween, fmt, todayIn } from "../dates";
import type { Reminder } from "../types";

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** transient => safe to retry later */
  transient?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const TYPE_LABEL: Record<string, string> = {
  task_due: "Task deadline",
  certificate_followup: "Hackathon follow-up",
  test: "Upcoming test",
  project_deadline: "Project deadline",
  milestone: "Project milestone",
  hackathon_submission: "Hackathon submission",
};

export function renderReminderEmail(r: Reminder, link: string) {
  const d = daysBetween(todayIn(r.timezone), r.event_date);
  const when = d < 0 ? `overdue since ${fmt.day(r.event_date)}` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
  const date = `${fmt.dayLong(r.event_date)}${r.event_time ? ` · ${fmt.time(r.event_time)}` : ""}`;
  const label = TYPE_LABEL[r.reminder_type] ?? "Reminder";
  const subject = `${r.title} — ${when}`;
  const context =
    r.reminder_type === "certificate_followup"
      ? "Your hackathon is complete. Upload the certificate to LinkedIn while the project is fresh."
      : r.reminder_type === "test"
        ? "Check your preparation status and open your study materials in Diva."
        : d < 0 ? "This is past its due date." : `This is due ${when}.`;
  const html = `<!doctype html><html><body style="margin:0;background:#0d0e12;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#ecebe6">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9c9da8">Diva · ${esc(label)}</div>
    <h1 style="font-size:20px;line-height:1.35;margin:10px 0 6px;color:#ecebe6">${esc(r.title)}</h1>
    <div style="font-size:14px;color:#d6ff70;margin-bottom:16px">${esc(date)}</div>
    <p style="font-size:14px;line-height:1.6;color:#c9c9cf;margin:0 0 22px">${esc(context)}</p>
    <a href="${esc(link)}" style="display:inline-block;background:#d6ff70;color:#14160a;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">Open in Diva</a>
    <p style="font-size:12px;color:#6e707d;margin-top:28px">You're receiving this because email reminders are on in Diva settings.</p>
  </div></body></html>`;
  const text = `${label}: ${r.title}\n${date}\n\n${context}\n\nOpen in Diva: ${link}`;
  return { subject, html, text };
}

/** Sends through Resend. The reminder's idempotency key is forwarded so the provider also de-duplicates. */
export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }, idempotencyKey: string): Promise<SendResult> {
  if (!isEmailConfigured()) return { ok: false, error: "Email provider is not configured", transient: true };
  try {
    const res = await fetch(`${env.resendUrl}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.resendKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({ from: env.emailFrom, to: [to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: body.id };
    const transient = res.status === 429 || res.status >= 500;
    return { ok: false, error: `Resend ${res.status}: ${body.message ?? body.name ?? "error"}`, transient };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", transient: true };
  }
}
