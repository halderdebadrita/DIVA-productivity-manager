import "server-only";
import { catBySlug, type Ctx } from "../context";
import type { Hackathon, Milestone, Project, Task, Test } from "../types";

/**
 * One normalised "agenda item" shape derived (never copied) from tasks, tests,
 * project deadlines, milestones and hackathon dates. The calendar, the date panel
 * and global search all read this, so they always agree with the source records.
 */
export interface AgendaItem {
  key: string;
  kind: "task" | "test" | "project" | "milestone" | "hackathon_submission" | "hackathon_event";
  id: string;
  title: string;
  date: string;
  time: string | null;
  categoryId: string;
  color: string;
  done: boolean;
  priority?: string;
  href: string;
  meta?: string;
}

export function buildAgenda(ctx: Ctx, d: { tasks: Task[]; tests: Test[]; projects: Project[]; milestones: Milestone[]; hackathons: Hackathon[] }) {
  const items: AgendaItem[] = [];
  const cat = (id: string) => ctx.categories.find((c) => c.id === id) ?? catBySlug(ctx, "other");
  for (const t of d.tasks) {
    if (!t.due_date) continue;
    const c = cat(t.category_id);
    items.push({ key: `task:${t.id}`, kind: "task", id: t.id, title: t.title, date: t.due_date, time: t.due_time, categoryId: c.id, color: c.color, done: t.status === "done", priority: t.priority, href: `/tasks?task=${t.id}` });
  }
  const tc = catBySlug(ctx, "tests");
  for (const t of d.tests) {
    items.push({ key: `test:${t.id}`, kind: "test", id: t.id, title: t.name, date: t.test_date, time: t.test_time, categoryId: tc.id, color: tc.color, done: false, href: `/tests#test-${t.id}`, meta: `${t.type === "practical" ? "Practical" : "Theory"} · ${t.subject}` });
  }
  const pc = catBySlug(ctx, "projects");
  for (const p of d.projects) {
    if (!p.deadline) continue;
    items.push({ key: `project:${p.id}`, kind: "project", id: p.id, title: `${p.name} deadline`, date: p.deadline, time: null, categoryId: pc.id, color: pc.color, done: p.status === "completed", href: `/projects/${p.id}`, meta: "Project deadline" });
  }
  for (const m of d.milestones) {
    if (!m.due_date) continue;
    const p = d.projects.find((x) => x.id === m.project_id);
    items.push({ key: `milestone:${m.id}`, kind: "milestone", id: m.id, title: m.title, date: m.due_date, time: null, categoryId: pc.id, color: pc.color, done: m.status === "done", href: `/projects/${m.project_id}?tab=tasks`, meta: p ? `Milestone · ${p.name}` : "Milestone" });
  }
  const hc = catBySlug(ctx, "hackathons");
  for (const h of d.hackathons) {
    const closed = h.status === "completed";
    if (h.submission_deadline)
      items.push({ key: `hsub:${h.id}`, kind: "hackathon_submission", id: h.id, title: `${h.name} submission`, date: h.submission_deadline, time: h.submission_time, categoryId: hc.id, color: hc.color, done: closed || h.status === "submitted", href: `/hackathons/${h.id}`, meta: "Submission deadline" });
    if (h.start_date)
      items.push({ key: `hevt:${h.id}`, kind: "hackathon_event", id: h.id, title: h.name, date: h.start_date, time: null, categoryId: hc.id, color: hc.color, done: closed, href: `/hackathons/${h.id}`, meta: h.end_date && h.end_date !== h.start_date ? `Hackathon starts (until ${h.end_date})` : "Hackathon" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}

export async function loadAll(ctx: Ctx) {
  const u = { eq: { user_id: ctx.userId } };
  const [tasks, tests, projects, milestones, hackathons] = await Promise.all([
    ctx.db.select<Task>("tasks", u),
    ctx.db.select<Test>("tests", u, { order: [{ column: "test_date" }] }),
    ctx.db.select<Project>("projects", u, { order: [{ column: "updated_at", ascending: false }] }),
    ctx.db.select<Milestone>("project_milestones", u, { order: [{ column: "sort_order" }, { column: "created_at" }] }),
    ctx.db.select<Hackathon>("hackathons", u),
  ]);
  return { tasks, tests, projects, milestones, hackathons };
}
