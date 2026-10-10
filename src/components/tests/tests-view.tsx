"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen, Clock, FlaskConical, GraduationCap, ListChecks, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { PREP_STATUSES, STUDY_RESOURCE_KINDS } from "@/lib/constants";
import { daysBetween, fmt } from "@/lib/dates";
import type { Resource, Task, Test } from "@/lib/types";
import { deleteTestAction, setPrepStatusAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/bits";
import { Select } from "@/components/ui/form";
import { Confirm } from "@/components/ui/confirm";
import { AddResourceDialog, ResourceList } from "@/components/resources/resource-manager";
import { useApp } from "@/components/shell/app-provider";
import { TestFormDialog } from "./test-form";

function PrepControl({ test }: { test: Test }) {
  const [pending, start] = useTransition();
  const idx = PREP_STATUSES.findIndex((p) => p.value === test.prep_status);
  return (
    <div role="radiogroup" aria-label={`Preparation for ${test.name}`} className={cn("flex gap-1", pending && "opacity-60")}>
      {PREP_STATUSES.map((p, i) => (
        <button
          key={p.value}
          role="radio"
          aria-checked={p.value === test.prep_status}
          title={p.label}
          onClick={() => start(async () => {
            const r = await setPrepStatusAction(test.id, p.value);
            if (!r.ok) toast.error(r.error);
          })}
          className={cn(
            "flex-1 rounded px-2 py-1 text-2xs font-medium transition-colors",
            i <= idx && idx > 0 ? (test.prep_status === "prepared" ? "bg-ok/20 text-ok" : "bg-accent/15 text-accent") : p.value === test.prep_status ? "bg-surface-3 text-fg" : "bg-surface-3 text-subtle hover:text-muted",
            p.value === test.prep_status && "ring-1 ring-inset ring-current",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function TestsView({ tests, resources, tasks }: { tests: Test[]; resources: Resource[]; tasks: Task[] }) {
  const app = useApp();
  const [type, setType] = useState("all");
  const [when, setWhen] = useState("upcoming");
  const [subject, setSubject] = useState("all");
  const [, start] = useTransition();
  const subjects = useMemo(() => Array.from(new Set(tests.map((t) => t.subject))).sort(), [tests]);

  const list = tests
    .filter((t) => (type === "all" || t.type === type) && (subject === "all" || t.subject === subject))
    .filter((t) => (when === "upcoming" ? t.test_date >= app.today : when === "past" ? t.test_date < app.today : true))
    .sort((a, b) => (when === "past" ? b.test_date.localeCompare(a.test_date) : a.test_date.localeCompare(b.test_date) || (a.test_time ?? "99").localeCompare(b.test_time ?? "99")));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Test type" className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {[{ v: "all", l: "All" }, { v: "theory", l: "Theory" }, { v: "practical", l: "Practical" }].map((o) => (
            <button key={o.v} role="tab" aria-selected={type === o.v} onClick={() => setType(o.v)} className={cn("rounded-md px-3 py-1 text-[13px]", type === o.v ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>{o.l}</button>
          ))}
        </div>
        <Select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Timeframe" className="h-8 w-auto py-1 text-[13px]">
          <option value="upcoming">Upcoming</option><option value="past">Completed / past</option><option value="all">All dates</option>
        </Select>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" className="h-8 w-auto py-1 text-[13px]">
          <option value="all">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <span className="ml-auto num text-2xs text-subtle">{list.length} test{list.length === 1 ? "" : "s"}</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={GraduationCap} title={when === "upcoming" ? "No upcoming tests" : "No tests here"} action={<TestFormDialog subjects={subjects} />}>Add theory and practical tests — they appear on your dashboard calendar automatically.</EmptyState>
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[27px] before:top-3 before:w-px before:bg-border sm:before:left-[31px]">
          {list.map((t) => {
            const d = daysBetween(app.today, t.test_date);
            const past = d < 0;
            const Icon = t.type === "practical" ? FlaskConical : BookOpen;
            const mats = resources.filter((r) => r.entity_type === "test" && r.entity_id === t.id);
            const linked = tasks.filter((x) => x.test_id === t.id && x.status !== "done");
            return (
              <li key={t.id} id={`test-${t.id}`} className="relative flex scroll-mt-24 gap-3 sm:gap-4">
                <div className={cn("relative z-10 flex w-14 shrink-0 self-start flex-col items-center rounded-lg border bg-surface py-1.5 sm:w-16", past ? "border-border opacity-60" : "border-border-strong")}>
                  <span className="text-2xs uppercase text-subtle">{fmt.day(t.test_date).split(" ")[1]}</span>
                  <span className="num text-lg font-semibold leading-tight">{Number(t.test_date.slice(8))}</span>
                  <span className={cn("num text-[10px]", d <= 3 && d >= 0 ? "text-accent" : "text-subtle")}>{past ? "done" : d === 0 ? "today" : `${d}d`}</span>
                </div>
                <article className={cn("card min-w-0 flex-1 p-4 target:ring-1 target:ring-accent", past && "opacity-70", t.type === "practical" && "border-dashed")}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={t.type === "practical" ? "bg-[#4FD1A1]/15 text-[#4FD1A1]" : ""} tone={t.type === "theory" ? "warn" : "neutral"}><Icon aria-hidden />{t.type === "practical" ? "Practical" : "Theory"}</Badge>
                        <span className="text-2xs text-subtle">{t.subject}</span>
                      </div>
                      <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight">{t.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3" />{fmt.dayLong(t.test_date)}{t.test_time ? ` · ${fmt.time(t.test_time)}` : " · time TBA"}</p>
                    </div>
                    <div className="flex">
                      <TestFormDialog test={t} subjects={subjects} />
                      <Confirm
                        title={`Delete ${t.name}?`}
                        description="Its reminders and study materials linked to this test are removed. Tasks linked to it are kept."
                        onConfirm={() => start(async () => { const r = await deleteTestAction(t.id); if (!r.ok) toast.error(r.error); else toast.success("Test deleted"); })}
                        trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${t.name}`}><Trash2 /></Button>}
                      />
                    </div>
                  </div>
                  <div className="mt-3"><PrepControl test={t} /></div>
                  {(t.syllabus || t.notes) && (
                    <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                      {t.syllabus && <div><p className="eyebrow">Syllabus</p><p className="mt-0.5 whitespace-pre-line text-muted">{t.syllabus}</p></div>}
                      {t.notes && <div><p className="eyebrow">Notes</p><p className="mt-0.5 whitespace-pre-line text-muted">{t.notes}</p></div>}
                    </div>
                  )}
                  <div className="mt-3 border-t border-border pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="eyebrow">Study material · {mats.length}</p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => app.newTask({ test_id: t.id, category_id: app.catBySlug("tests").id, title: `Prepare: ${t.name}` })}><ListChecks />Prep task{linked.length ? ` (${linked.length})` : ""}</Button>
                        <AddResourceDialog entityType="test" entityId={t.id} kinds={STUDY_RESOURCE_KINDS} subjects={subjects} label="Add material" triggerVariant="ghost" />
                      </div>
                    </div>
                    {mats.length > 0 && <ResourceList resources={mats.map((m) => ({ ...m, subject: m.subject ?? t.subject }))} kinds={STUDY_RESOURCE_KINDS} compact />}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
