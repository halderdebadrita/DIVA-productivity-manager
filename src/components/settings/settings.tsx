"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, Play, RefreshCw, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/dates";
import type { Category, Reminder, ReminderPrefs } from "@/lib/types";
import {
  wipeDataAction, saveQuickLinksAction, retryReminderAction, runRemindersNowAction, saveCategoryAction, saveProfileAction, saveReminderPrefsAction,
} from "@/app/actions/misc";
import { Button } from "@/components/ui/button";
import { Badge, EmailStatusBadge, SectionCard } from "@/components/ui/bits";
import { Field, Input, Select } from "@/components/ui/form";
import { Confirm } from "@/components/ui/confirm";
import { useApp } from "@/components/shell/app-provider";
import { LinkMark } from "@/components/shell/quick-link";
import { QUICK_LINK_DEFS } from "@/lib/quick-links";

export function ProfileForm({ name, timezone }: { name: string; timezone: string }) {
  const [pending, start] = useTransition();
  const zones = useMemo(() => {
    let list: string[] = [];
    try {
      list = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      list = ["UTC"];
    }
    // Browsers may list legacy aliases (e.g. Asia/Calcutta) — always include the saved zone so it stays selected.
    return Array.from(new Set([timezone, "Asia/Kolkata", ...list])).sort();
  }, [timezone]);
  return (
    <SectionCard title="Profile">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await saveProfileAction({ display_name: fd.get("display_name"), timezone: fd.get("timezone") });
            if (r.ok) toast.success("Profile saved"); else toast.error(r.error);
          });
        }}
      >
        <Field label="Display name" htmlFor="s-name"><Input id="s-name" name="display_name" defaultValue={name} maxLength={60} /></Field>
        <Field label="Timezone" htmlFor="s-tz" hint="Used for 'today', the daily topic and reminder times">
          <Select id="s-tz" name="timezone" defaultValue={timezone}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select>
        </Field>
        <Button type="submit" variant="primary" loading={pending} className="sm:mb-[18px]"><Save />Save</Button>
      </form>
    </SectionCard>
  );
}

const OFFSET_FIELDS: { key: keyof ReminderPrefs; label: string; hint: string }[] = [
  { key: "task_offsets", label: "Tasks & assignments", hint: "e.g. 1, 0 = day before and on the day" },
  { key: "test_offsets", label: "Tests & exams", hint: "e.g. 3, 1" },
  { key: "project_offsets", label: "Project deadlines", hint: "e.g. 3, 0" },
  { key: "hackathon_offsets", label: "Hackathon submissions", hint: "e.g. 2, 0" },
  { key: "followup_offsets", label: "Certificate follow-ups", hint: "0 = on the due day (3 days after completion)" },
];

const parseOffsets = (s: string) =>
  Array.from(new Set(s.split(/[,\s]+/).filter(Boolean).map(Number))).filter((n) => Number.isInteger(n) && n >= 0 && n <= 30).sort((a, b) => b - a).slice(0, 4);

export function ReminderPrefsForm({ prefs, profileEmail, emailConfigured }: { prefs: ReminderPrefs; profileEmail: string | null; emailConfigured: boolean }) {
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(prefs.email_enabled);
  const [error, setError] = useState<string | null>(null);
  return (
    <SectionCard id="reminders" title="Reminders">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const payload = {
            email_enabled: enabled,
            email: String(fd.get("email") || ""),
            send_hour: Number(fd.get("send_hour")),
            ...Object.fromEntries(OFFSET_FIELDS.map((f) => [f.key, parseOffsets(String(fd.get(f.key) || ""))])),
          };
          start(async () => {
            const r = await saveReminderPrefsAction(payload);
            if (!r.ok) return setError(r.error);
            setError(null);
            toast.success("Reminder preferences saved — schedule updated");
          });
        }}
      >
        <p className="text-[13px] text-muted">The dashboard panel and emails use the same reminder records. A day-of reminder always appears in the app; the offsets below control which days you get <em>emails</em>.</p>
        <label className="flex items-center gap-3">
          <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)} className={cn("relative h-5 w-9 rounded-full transition-colors", enabled ? "bg-accent" : "bg-surface-3")}>
            <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", enabled ? "left-[18px]" : "left-0.5")} />
          </button>
          <span className="text-sm">Email reminders</span>
          {!emailConfigured && <Badge tone="warn">Provider not configured</Badge>}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Send to" htmlFor="rp-email" hint={profileEmail ? `Leave blank to use ${profileEmail}` : "Where reminder emails go"}>
            <Input id="rp-email" name="email" type="email" defaultValue={prefs.email ?? ""} placeholder={profileEmail ?? "you@example.com"} disabled={!enabled} />
          </Field>
          <Field label="Send time" htmlFor="rp-hour" hint="Local time; events earlier than this are reminded 1h before">
            <Select id="rp-hour" name="send_hour" defaultValue={String(prefs.send_hour)}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmt.time(`${String(h).padStart(2, "0")}:00`)}</option>)}
            </Select>
          </Field>
          {OFFSET_FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label} — days before`} htmlFor={`rp-${f.key}`} hint={f.hint}>
              <Input id={`rp-${f.key}`} name={f.key} defaultValue={(prefs[f.key] as number[]).join(", ")} inputMode="numeric" />
            </Field>
          ))}
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end"><Button type="submit" variant="primary" loading={pending}><Save />Save reminder settings</Button></div>
      </form>
    </SectionCard>
  );
}

const TYPE: Record<string, string> = { task_due: "Task", certificate_followup: "Follow-up", test: "Test", project_deadline: "Project", milestone: "Milestone", hackathon_submission: "Hackathon" };

export function DeliveryLog({ log, emailConfigured, recipient }: { log: { recent: Reminder[]; upcoming: Reminder[]; dueNow: number }; emailConfigured: boolean; recipient: string | null }) {
  const app = useApp();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"upcoming" | "recent">("upcoming");
  const rows = tab === "upcoming" ? log.upcoming : log.recent;
  return (
    <SectionCard
      title="Email delivery"
      actions={
        <Button size="sm" loading={pending} onClick={() => start(async () => {
          const r = await runRemindersNowAction();
          if (!r.ok) return void toast.error(r.error);
          const d = r.data;
          toast.success("Reminder job ran", { description: d.note ?? `${d.sent} sent · ${d.failed} failed · ${d.skipped} skipped · ${d.waiting} waiting` });
        })}><Play />Process due now</Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        {emailConfigured ? <Badge tone="ok"><CheckCircle2 aria-hidden />Provider configured</Badge> : <Badge tone="warn"><CircleDashed aria-hidden />Provider not configured — emails stay pending</Badge>}
        <span className="text-muted">Recipient: {recipient ?? <span className="text-warn">not set</span>}</span>
        {log.dueNow > 0 && <Badge tone="outline">{log.dueNow} due now</Badge>}
      </div>
      <p className="mb-3 text-2xs text-subtle">Emails are sent by the scheduled job (<code className="font-mono">/api/cron/reminders</code>), not by opening the website. “Process due now” runs the same job for your account only.</p>
      <div className="mb-2 flex gap-1">
        {(["upcoming", "recent"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={cn("rounded-md px-2.5 py-1 text-[13px]", tab === t ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
            {t === "upcoming" ? `Scheduled (${log.upcoming.length})` : `Sent & failed (${log.recent.length})`}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{tab === "upcoming" ? "No emails scheduled." : "No delivery attempts yet."}</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead><tr className="text-left text-2xs text-subtle"><th className="px-1 py-1.5 font-medium">Reminder</th><th className="px-1 font-medium">Type</th><th className="px-1 font-medium">{tab === "upcoming" ? "Sends" : "When"}</th><th className="px-1 font-medium">Status</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="max-w-[260px] truncate px-1 py-2">{r.title}<span className="block text-2xs text-subtle">event {fmt.day(r.event_date)}{r.offset_days ? ` · ${r.offset_days}d before` : " · day of"}</span></td>
                  <td className="px-1 text-muted">{TYPE[r.reminder_type] ?? r.reminder_type}</td>
                  <td className="px-1 num text-2xs text-muted">{fmt.instant(tab === "upcoming" ? r.remind_at : r.sent_at ?? r.updated_at, app.tz)}</td>
                  <td className="px-1"><EmailStatusBadge status={r.email_status} title={r.last_error ?? undefined} />{r.email_status === "failed" && <span className="block text-2xs text-subtle">{r.email_attempts} attempt{r.email_attempts === 1 ? "" : "s"}{r.next_attempt_at ? ` · retry ${fmt.instant(r.next_attempt_at, app.tz)}` : " · no more retries"}</span>}</td>
                  <td className="px-1 text-right">
                    {r.email_status === "failed" && (
                      <Button size="sm" variant="ghost" onClick={() => start(async () => { const x = await retryReminderAction(r.id); if (x.ok) toast.success("Queued for retry"); else toast.error(x.error); })}><RefreshCw />Retry</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function CategoriesForm({ categories }: { categories: Category[] }) {
  const [pending, start] = useTransition();
  return (
    <SectionCard title="Categories & colours">
      <p className="mb-3 text-[13px] text-muted">One colour per category, used everywhere: calendar, task rows, monthly list and reminders.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id}>
            <form
              className="flex items-center gap-2 rounded-md border border-border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  const r = await saveCategoryAction(c.id, { name: fd.get("name"), color: fd.get("color") });
                  if (r.ok) toast.success(`${fd.get("name")} saved`); else toast.error(r.error);
                });
              }}
            >
              <input type="color" name="color" defaultValue={c.color} aria-label={`${c.name} colour`} className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent" />
              <Input name="name" defaultValue={c.name} aria-label="Category name" className="h-8 py-1 text-[13px]" maxLength={40} />
              <Button type="submit" size="sm" variant="ghost" disabled={pending}>Save</Button>
            </form>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

type Status = { mode: "supabase" | "demo"; supabase: boolean; serviceRole: boolean; ai: boolean; aiProvider: string; aiModel: string | null; email: boolean; cron: boolean; github: boolean };

export function IntegrationsPanel({ status, mode }: { status: Status; mode: "supabase" | "demo" }) {
  const rows = [
    { name: "Database & auth (Supabase)", ok: status.supabase, detail: status.supabase ? "Connected — data is private to your account (RLS)" : "Demo mode — local file storage", env: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY" },
    { name: "Scheduler access (service role)", ok: status.serviceRole || !status.supabase, detail: status.supabase ? (status.serviceRole ? "Configured" : "Needed so the cron job can read every user's reminders") : "Not needed in demo mode", env: "SUPABASE_SERVICE_ROLE_KEY" },
    { name: "AI", ok: status.ai, detail: status.ai ? `${status.aiProvider} · ${status.aiModel}` : "Not configured — learning & quests use labelled fallbacks", env: status.aiProvider === "openai" ? "OPENAI_API_KEY, AI_MODEL" : status.aiProvider === "gemini" ? "GEMINI_API_KEY, AI_MODEL (optional)" : "ANTHROPIC_API_KEY, AI_MODEL (optional)" },
    { name: "Email (Resend)", ok: status.email, detail: status.email ? "Configured" : "Not configured — reminders stay in-app; no email is claimed as sent", env: "RESEND_API_KEY, EMAIL_FROM" },
    { name: "Scheduled job secret", ok: status.cron || !status.supabase, detail: status.cron ? "Configured" : status.supabase ? "Required to protect /api/cron/reminders" : "Optional in local demo mode", env: "CRON_SECRET" },
    { name: "GitHub", ok: true, detail: status.github ? "Server token configured — higher limits & private repos" : "Public repositories only (60 requests/hour)", env: "GITHUB_TOKEN (optional)" },
  ];
  const [pending, start] = useTransition();
  return (
    <SectionCard id="integrations" title="Integrations">
      <ul className="divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
            {r.ok ? <CheckCircle2 className="mt-0.5 size-4 text-ok" aria-label="Configured" /> : <CircleDashed className="mt-0.5 size-4 text-warn" aria-label="Not configured" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm">{r.name}</p>
              <p className="text-2xs text-muted">{r.detail}</p>
            </div>
            <code className="font-mono text-2xs text-subtle">{r.env}</code>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-2xs text-subtle">Secrets are read on the server only and never sent to the browser. See README.md for setup.</p>
    </SectionCard>
  );
}

export function DataPanel() {
  const [pending, start] = useTransition();
  const [learning, setLearning] = useState(false);
  return (
    <SectionCard id="data" title="Your data">
      <p className="text-[13px] text-muted">
        Clear every task, test, project, milestone, hackathon, saved file/link, side quest and reminder. Your profile, settings, categories and quick links are kept.
      </p>
      <label className="mt-3 flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={learning} onChange={(e) => setLearning(e.target.checked)} className="accent-[rgb(214,255,112)]" />
        Also delete my Diva Keeps Learning history
      </label>
      <div className="mt-3">
        <Confirm
          title="Delete all your data?"
          description="This permanently removes all tasks, tests, projects, hackathons, files and reminders. It can't be undone."
          confirmLabel="Delete everything"
          onConfirm={() => start(async () => {
            const r = await wipeDataAction({ learning });
            if (r.ok) toast.success("All data cleared — Diva is a blank slate"); else toast.error(r.error);
          })}
          trigger={<Button size="sm" variant="danger" loading={pending}><RotateCcw />Clear all data</Button>}
        />
      </div>
    </SectionCard>
  );
}

export function QuickLinksForm() {
  const { links } = useApp();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <SectionCard id="quick-links" title="Quick links">
      <p className="mb-3 text-[13px] text-muted">
        These open in a new tab in your normal browser, so they use the accounts you&apos;re already signed in to there. Replace a link with your own page (for example your GitHub profile or notes folder), or clear it to hide the button.
      </p>
      <form
        className="space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const data = Object.fromEntries(QUICK_LINK_DEFS.map((d) => [d.key, String(fd.get(d.key) ?? "")]));
          start(async () => {
            const r = await saveQuickLinksAction(data);
            if (!r.ok) return setError(r.error);
            setError(null);
            toast.success("Quick links saved");
          });
        }}
      >
        {QUICK_LINK_DEFS.map((d) => (
          <div key={d.key} className="grid items-center gap-2 sm:grid-cols-[190px_1fr]">
            <label htmlFor={`ql-${d.key}`} className="flex items-center gap-2 text-[13px]">
              <LinkMark k={d.key} />
              <span className="min-w-0"><span className="block font-medium">{d.label}</span><span className="block truncate text-2xs text-subtle">{d.where}</span></span>
            </label>
            <div>
              <Input id={`ql-${d.key}`} name={d.key} type="url" defaultValue={links[d.key] ?? ""} placeholder={d.url || "https://"} className="h-8 py-1 text-[13px]" />
              <p className="mt-0.5 text-2xs text-subtle">{d.hint}</p>
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end"><Button type="submit" variant="primary" loading={pending}><Save />Save quick links</Button></div>
      </form>
    </SectionCard>
  );
}
