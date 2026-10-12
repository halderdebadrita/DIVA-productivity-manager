"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellRing, Check, ChevronDown, Settings2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt, relativeDay } from "@/lib/dates";
import type { PanelItem } from "@/lib/services/reminders";
import { acknowledgeAction } from "@/app/actions/misc";
import { toggleTaskAction } from "@/app/actions/tasks";
import { Badge, CategoryDot, EmailStatusBadge, EmptyState, PriorityBadge, SectionCard } from "@/components/ui/bits";
import { useApp } from "@/components/shell/app-provider";

const TYPE_LABEL: Record<string, string> = {
  task_due: "Task",
  certificate_followup: "Certificate follow-up",
  test: "Test",
  project_deadline: "Project deadline",
  milestone: "Milestone",
  hackathon_submission: "Hackathon submission",
};

function Item({ r }: { r: PanelItem }) {
  const app = useApp();
  const [pending, start] = useTransition();
  const cat = app.catBySlug(r.category_slug ?? "other");
  const emailTitle =
    r.email.status === "sent" ? `Last emailed ${fmt.instant(r.email.lastSentAt, app.tz)}`
    : r.email.status === "pending" ? `Next email ${fmt.instant(r.email.nextAt, app.tz)}`
    : r.email.status === "failed" ? r.email.lastError ?? "Delivery failed — will retry"
    : undefined;
  const emailStatus = !app.integrations.email && (r.email.status === "pending" || r.email.status === "failed") ? "unconfigured" : r.email.status;
  return (
    <li className={cn("group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-2", pending && "opacity-50")}>
      <CategoryDot color={cat.color} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        {r.entity_type === "task" ? (
          <button type="button" onClick={() => app.openTask(r.entity_id)} className="block w-full truncate text-left text-sm hover:underline">{r.title}</button>
        ) : (
          <Link href={r.href} className="block truncate text-sm hover:underline">{r.title}</Link>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={cn("text-2xs num", r.bucket === "overdue" ? "text-danger" : r.bucket === "today" ? "text-accent" : "text-subtle")}>
            {relativeDay(r.event_date, app.today)}{r.event_time ? ` · ${fmt.time(r.event_time)}` : ""}
          </span>
          <span className="text-2xs text-subtle">· {TYPE_LABEL[r.reminder_type] ?? cat.name}</span>
          <PriorityBadge priority={r.priority} compact />
          {emailStatus !== "unconfigured" && <EmailStatusBadge status={emailStatus} title={emailTitle} />}
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {r.entity_type === "task" && (
          <button
            className="rounded p-1.5 text-subtle hover:bg-surface-3 hover:text-ok"
            aria-label={`Complete ${r.title}`}
            title="Mark task complete"
            onClick={() => start(async () => {
              const res = await toggleTaskAction(r.entity_id, true);
              if (res.ok) toast.success("Task completed", { description: r.title }); else toast.error(res.error);
            })}
          >
            <Check className="size-4" />
          </button>
        )}
        <button
          className="rounded p-1.5 text-subtle hover:bg-surface-3 hover:text-fg"
          aria-label={`Acknowledge reminder for ${r.title}`}
          title="Acknowledge (hide from this panel)"
          onClick={() => start(async () => {
            const res = await acknowledgeAction(r.entity_type, r.entity_id, r.event_date);
            if (!res.ok) toast.error(res.error);
          })}
        >
          <X className="size-4" />
        </button>
      </div>
    </li>
  );
}

export function RemindersPanel({ items }: { items: PanelItem[] }) {
  const app = useApp();
  const [showLater, setShowLater] = useState(false);
  const groups: { key: PanelItem["bucket"]; label: string; tone?: string }[] = [
    { key: "overdue", label: "Overdue", tone: "!text-danger" },
    { key: "today", label: "Today" },
    { key: "soon", label: "Next 7 days" },
  ];
  const later = items.filter((i) => i.bucket === "later");
  const near = items.filter((i) => i.bucket !== "later");
  return (
    <SectionCard
      id="reminders"
      title="Reminders"
      icon={BellRing}
      actions={<Link href="/settings#reminders" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"><Settings2 className="size-3.5" />Preferences</Link>}
      bodyClassName="px-2 sm:px-3"
    >
      {!app.integrations.email && (
        <p className="mx-2 mb-3 rounded-md border border-warn/20 bg-warn/[0.06] px-3 py-2 text-2xs text-warn">
          In-app reminders are live. Email delivery needs configuration (RESEND_API_KEY + EMAIL_FROM) — nothing is being emailed yet.
        </p>
      )}
      {near.length === 0 && !showLater ? (
        <EmptyState icon={BellRing} title="No reminders this week" className="mx-2">Deadlines, tests and follow-ups within 7 days show up here.</EmptyState>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const its = near.filter((i) => i.bucket === g.key);
            if (!its.length) return null;
            return (
              <div key={g.key}>
                <h3 className={`mb-0.5 px-2 eyebrow ${g.tone ?? ""}`}>{g.label} · <span className="num">{its.length}</span></h3>
                <ul>{its.map((r) => <Item key={r.groupKey} r={r} />)}</ul>
              </div>
            );
          })}
        </div>
      )}
      {later.length > 0 && (
        <div className="mt-3 border-t border-border px-2 pt-3">
          <button type="button" onClick={() => setShowLater((s) => !s)} aria-expanded={showLater} className="flex items-center gap-1 text-2xs text-subtle hover:text-fg">
            <ChevronDown className={cn("size-3.5 transition-transform", !showLater && "-rotate-90")} />
            Upcoming reminders <Badge>{later.length}</Badge>
          </button>
          {showLater && <ul className="-mx-2 mt-1">{later.map((r) => <Item key={r.groupKey} r={r} />)}</ul>}
        </div>
      )}
    </SectionCard>
  );
}
