import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, GraduationCap } from "lucide-react";
import { getCtx } from "@/lib/context";
import { isAIConfigured } from "@/lib/env";
import { daysBetween, fmt, todayIn, nowTimeIn, addDays } from "@/lib/dates";
import { buildAgenda, loadAll } from "@/lib/services/agenda";
import { todayBuckets } from "@/lib/services/tasks";
import { reminderPanel } from "@/lib/services/reminders";
import { ensureTodayTopic, getTodayTopic, type LearningState } from "@/lib/services/learning";
import { featuredQuest } from "@/lib/services/side-quests";
import { TodayTasks } from "@/components/dashboard/today-tasks";
import { RemindersPanel } from "@/components/dashboard/reminders-panel";
import { Calendar } from "@/components/dashboard/calendar";
import { MonthTasks } from "@/components/dashboard/month-tasks";
import { LearningCard } from "@/components/dashboard/learning-card";
import { SideQuestCard } from "@/components/dashboard/side-quest";
import { cn } from "@/lib/cn";

export const metadata = { title: "Dashboard" };

function greeting(time: string) {
  const h = Number(time.slice(0, 2));
  return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const ctx = await getCtx();
  const all = await loadAll(ctx);
  const today = todayIn(ctx.tz);
  const b = todayBuckets(all.tasks, ctx.tz);
  const agenda = buildAgenda(ctx, all);
  const reminders = await reminderPanel(ctx, { milestoneProject: new Map(all.milestones.map((m) => [m.id, m.project_id])) });
  const quests = await featuredQuest(ctx);

  // Learning: reuse today's stored topic; never call the AI during render.
  const stored = await getTodayTopic(ctx);
  const learning: LearningState | null = stored ? { status: "ok", topic: stored } : !isAIConfigured() ? await ensureTodayTopic(ctx) : null;

  const upcomingTests = all.tests.filter((t) => t.test_date >= today && t.test_date <= addDays(today, 14));
  const nextTest = upcomingTests[0];
  const pct = b.dueTodayCount ? Math.round((b.doneToday / b.dueTodayCount) * 100) : null;
  const openToday = b.dueTodayCount - b.doneToday;

  const stats = [
    { href: "/tasks?view=today", label: "Due today", value: String(openToday), sub: b.dueTodayCount ? `${b.doneToday} of ${b.dueTodayCount} done` : "Nothing scheduled", icon: CalendarClock, tone: "" },
    { href: "/tasks?view=overdue", label: "Overdue", value: String(b.overdue.length), sub: b.overdue.length ? `Oldest ${fmt.day(b.overdue[0].due_date!)}` : "All clear", icon: AlertTriangle, tone: b.overdue.length ? "text-danger" : "" },
    { href: "/tests", label: "Tests · 14 days", value: String(upcomingTests.length), sub: nextTest ? `${nextTest.name} in ${daysBetween(today, nextTest.test_date)}d` : "None coming up", icon: GraduationCap, tone: "" },
    { href: "/tasks?view=today", label: "Today's progress", value: pct === null ? "—" : `${pct}%`, sub: pct === null ? "No tasks due today" : pct === 100 ? "Everything done" : "of today's tasks", icon: CheckCircle2, tone: pct === 100 ? "text-ok" : "", progress: pct },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[13px] text-muted">{fmt.dayLong(today)}</p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight sm:text-2xl">
            {greeting(nowTimeIn(ctx.tz))}, {ctx.profile.display_name}.
          </h1>
          <p className="mt-1 text-sm text-muted">
            {openToday + b.overdue.length === 0
              ? "Your slate is clear today."
              : `${openToday} task${openToday === 1 ? "" : "s"} due today${b.overdue.length ? ` and ${b.overdue.length} overdue` : ""}${nextTest ? ` · next test: ${nextTest.name}, ${fmt.weekdayShort(nextTest.test_date)}` : ""}.`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[640px]">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="card group px-3.5 py-3 transition-colors hover:border-border-strong">
              <div className="flex items-center justify-between">
                <span className="text-2xs text-subtle">{s.label}</span>
                <s.icon className={cn("size-3.5 text-subtle", s.tone)} />
              </div>
              <p className={cn("mt-1 num text-xl font-semibold", s.tone)}>{s.value}</p>
              {"progress" in s && s.progress !== null && s.progress !== undefined ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${s.progress}%` }} /></div>
              ) : (
                <p className="mt-0.5 truncate text-2xs text-subtle">{s.sub}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 [&>*]:min-w-0 xl:grid-cols-12">
        <div className="space-y-4 sm:space-y-5 xl:col-span-7">
          <TodayTasks overdue={b.overdue} main={b.todayMain} optional={b.todayOptional} />
          <Calendar items={agenda} />
          <MonthTasks tasks={all.tasks} />
        </div>
        <div className="space-y-4 sm:space-y-5 xl:col-span-5">
          <RemindersPanel items={reminders} />
          <LearningCard initial={learning} />
          <SideQuestCard current={quests.current} completed={quests.completed} />
        </div>
      </div>
    </div>
  );
}
