import "server-only";
import type { Ctx } from "../context";
import type { Hackathon, Project, Resource, Task, Test } from "../types";

export interface SearchHit {
  type: "task" | "test" | "project" | "hackathon" | "resource";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function searchAll(ctx: Ctx, q: string): Promise<SearchHit[]> {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(needle));
  const u = { eq: { user_id: ctx.userId } };
  const [tasks, tests, projects, hackathons, resources] = await Promise.all([
    ctx.db.select<Task>("tasks", u),
    ctx.db.select<Test>("tests", u),
    ctx.db.select<Project>("projects", u),
    ctx.db.select<Hackathon>("hackathons", u),
    ctx.db.select<Resource>("resources", u),
  ]);
  const hits: SearchHit[] = [
    ...tasks.filter((t) => has(t.title, t.description)).map((t) => ({ type: "task" as const, id: t.id, title: t.title, subtitle: t.status === "done" ? "Task · done" : t.due_date ? `Task · due ${t.due_date}` : "Task · no date", href: `/tasks?task=${t.id}` })),
    ...tests.filter((t) => has(t.name, t.subject, t.syllabus)).map((t) => ({ type: "test" as const, id: t.id, title: t.name, subtitle: `${t.type} test · ${t.subject} · ${t.test_date}`, href: `/tests#test-${t.id}` })),
    ...projects.filter((p) => has(p.name, p.description, p.tech_stack.join(" "))).map((p) => ({ type: "project" as const, id: p.id, title: p.name, subtitle: `Project · ${p.status.replace("_", " ")}`, href: `/projects/${p.id}` })),
    ...hackathons.filter((h) => has(h.name, h.description, h.brain_dump)).map((h) => ({ type: "hackathon" as const, id: h.id, title: h.name, subtitle: `Hackathon · ${h.status.replace("_", " ")}`, href: `/hackathons/${h.id}` })),
    ...resources.filter((r) => has(r.title, r.subject, r.description)).map((r) => ({
      type: "resource" as const,
      id: r.id,
      title: r.title,
      subtitle: `Resource · ${r.kind}${r.subject ? ` · ${r.subject}` : ""}`,
      href: r.entity_type === "project" && r.entity_id ? `/projects/${r.entity_id}` : r.entity_type === "hackathon" && r.entity_id ? `/hackathons/${r.entity_id}` : `/tests/materials`,
    })),
  ];
  return hits.slice(0, 30);
}
