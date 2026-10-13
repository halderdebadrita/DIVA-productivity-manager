import "server-only";
import { z } from "zod";
import { catBySlug, type Ctx } from "../context";
import { addDays, todayIn, nowTimeIn } from "../dates";
import { format, parseISO } from "date-fns";
import { AIError, generateJSON } from "../integrations/ai";
import type { Hackathon, Project, Test } from "../types";
import { createTask } from "./tasks";
import { createTest } from "./tests";

/**
 * "Tell Diva" — turn free text ("DBMS assignment due friday 5pm, OS lab test on the 20th…")
 * into structured tasks/tests. The AI only PROPOSES; nothing is saved until you confirm.
 */

const SLUGS = ["academics", "tests", "projects", "hackathons", "personal", "learning", "other"] as const;
const nullish = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === "" || v === undefined ? null : v), t.nullable());

const itemSchema = z.object({
  kind: z.enum(["task", "test"]).default("task"),
  title: z.string().trim().min(1).max(200),
  date: nullish(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  time: nullish(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)),
  category: z.preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), z.enum(SLUGS).catch("other")),
  priority: z.enum(["low", "medium", "high", "urgent"]).catch("medium"),
  estimated_minutes: nullish(z.number().int().min(5).max(2880)).catch(null),
  description: nullish(z.string().max(1000)).catch(null),
  project: nullish(z.string().max(200)).catch(null),
  test: nullish(z.string().max(200)).catch(null),
  hackathon: nullish(z.string().max(200)).catch(null),
  test_type: nullish(z.enum(["theory", "practical"])).catch(null),
  subject: nullish(z.string().max(120)).catch(null),
});
const planSchema = z.object({
  reply: z.string().max(600).default(""),
  items: z.array(itemSchema).max(25),
});

export interface PlannedItem {
  kind: "task" | "test";
  title: string;
  date: string | null;
  time: string | null;
  category: string; // slug
  priority: "low" | "medium" | "high" | "urgent";
  estimated_minutes: number | null;
  description: string | null;
  project_id: string | null;
  test_id: string | null;
  hackathon_id: string | null;
  test_type: "theory" | "practical" | null;
  subject: string | null;
  link_label: string | null;
  test_name: string | null; // test mentioned in the same message (linked on save)
}

const SYSTEM = `You are Diva's planning assistant for a university student (computer science).
Turn the user's free-form message into concrete items. Rules:
- One item per distinct thing to do. Keep titles short and actionable (start with a verb when natural).
- kind "test" ONLY for an exam/quiz/viva/practical exam itself (needs a date). Studying FOR a test is a "task" with category "tests" and "test" set to the exam name.
- Resolve relative dates ("tomorrow", "friday", "next week", "on the 20th") using the calendar provided. Never invent a date the user didn't imply; use null. "end of week" = the coming Sunday.
- time in 24h HH:mm only if stated ("5pm" -> "17:00", "morning" -> null).
- category: one of academics, tests, projects, hackathons, personal, learning, other.
- priority: urgent only if the user signals urgency or it's due within 24h; high for graded/important; low for optional/"if I have time".
- If an item clearly belongs to one of the user's existing projects/tests/hackathons, put that exact name in "project"/"test"/"hackathon".
- If a big item is due later, you MAY add 1-2 prep tasks before it, but only if the user asks you to plan/break things down.
- "reply": one or two friendly sentences summarising what you organised (mention anything ambiguous).
Return ONLY JSON: {"reply": string, "items": [{"kind","title","date","time","category","priority","estimated_minutes","description","project","test","hackathon","test_type","subject"}]}`;

function calendarContext(ctx: Ctx) {
  const today = todayIn(ctx.tz);
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = addDays(today, i);
    return `${format(parseISO(d), "EEE")} ${d}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""}`;
  });
  return { today, text: `Now: ${today} ${nowTimeIn(ctx.tz)} (${ctx.tz}).\nCalendar:\n${days.join("\n")}` };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function matchName<T extends { id: string }>(rows: T[], name: string | null, get: (r: T) => string) {
  if (!name) return null;
  const n = norm(name);
  return (
    rows.find((r) => norm(get(r)) === n) ??
    rows.find((r) => norm(get(r)).includes(n) || n.includes(norm(get(r)))) ??
    null
  );
}

export async function planFromText(ctx: Ctx, text: string): Promise<{ reply: string; items: PlannedItem[]; model: string }> {
  const message = text.trim();
  if (!message) throw new Error("Type what you need to do first");
  const u = { eq: { user_id: ctx.userId } };
  const [projects, tests, hackathons] = await Promise.all([
    ctx.db.select<Project>("projects", u),
    ctx.db.select<Test>("tests", u),
    ctx.db.select<Hackathon>("hackathons", u),
  ]);
  const cal = calendarContext(ctx);
  const known = [
    projects.length ? `Projects: ${projects.map((p) => p.name).join(" | ")}` : "Projects: none",
    tests.length ? `Tests: ${tests.filter((t) => t.test_date >= cal.today).map((t) => `${t.name} (${t.subject}, ${t.test_date})`).join(" | ") || "none upcoming"}` : "Tests: none",
    hackathons.length ? `Hackathons: ${hackathons.filter((h) => h.status !== "completed").map((h) => h.name).join(" | ") || "none active"}` : "Hackathons: none",
  ].join("\n");

  const { data, model } = await generateJSON(planSchema, SYSTEM, `${cal.text}\n\n${known}\n\nUser message:\n"""${message.slice(0, 4000)}"""`, 2000);

  const items: PlannedItem[] = data.items.map((i) => {
    const project = matchName(projects, i.project, (p) => p.name);
    const test = matchName(tests, i.test, (t) => t.name);
    const hack = matchName(hackathons, i.hackathon, (h) => h.name);
    // a test needs a date; without one it becomes a reminder task
    const kind = i.kind === "test" && i.date ? "test" : "task";
    return {
      kind,
      title: i.title,
      date: i.date,
      time: i.time,
      category: kind === "test" ? "tests" : i.category,
      priority: i.priority,
      estimated_minutes: i.estimated_minutes,
      description: i.description,
      project_id: project?.id ?? null,
      test_id: kind === "task" ? test?.id ?? null : null,
      hackathon_id: hack?.id ?? null,
      test_type: kind === "test" ? i.test_type ?? "theory" : null,
      subject: kind === "test" ? i.subject ?? i.title : null,
      link_label: project?.name ?? test?.name ?? hack?.name ?? (kind === "task" ? i.test : null) ?? null,
      test_name: kind === "task" && !test ? i.test : null,
    };
  });
  return { reply: data.reply || `I found ${items.length} item${items.length === 1 ? "" : "s"}.`, items, model };
}

/** Fallback when AI is unavailable: one undated task per line, for you to review. */
export function planWithoutAI(text: string): PlannedItem[] {
  return text
    .split(/\n|;|•/)
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 1)
    .slice(0, 25)
    .map((title) => ({
      kind: "task" as const, title: title.slice(0, 200), date: null, time: null, category: "other", priority: "medium" as const,
      estimated_minutes: null, description: null, project_id: null, test_id: null, hackathon_id: null, test_type: null, subject: null, link_label: null, test_name: null,
    }));
}

const commitItem = z.object({
  kind: z.enum(["task", "test"]),
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  category: z.enum(SLUGS),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  estimated_minutes: z.number().int().min(1).max(10080).nullable(),
  description: z.string().max(1000).nullable(),
  project_id: z.string().nullable(),
  test_id: z.string().nullable(),
  hackathon_id: z.string().nullable(),
  test_type: z.enum(["theory", "practical"]).nullable(),
  subject: z.string().max(120).nullable(),
  test_name: z.string().max(200).nullable().optional(),
});

export async function commitPlan(ctx: Ctx, raw: unknown) {
  const items = z.array(commitItem).min(1, "Nothing selected").max(25).parse(raw);
  let tasks = 0;
  let testsCreated = 0;
  const created: { id: string; name: string }[] = [];
  // tests first, so tasks in the same message can link to them
  for (const i of items.filter((x) => x.kind === "test" && x.date)) {
    const t = await createTest(ctx, {
      name: i.title, subject: i.subject || i.title, type: i.test_type ?? "theory", test_date: i.date, test_time: i.time,
      prep_status: "not_started", syllabus: null, notes: i.description,
    });
    created.push({ id: t.id, name: t.name });
    testsCreated++;
  }
  for (const i of items.filter((x) => !(x.kind === "test" && x.date))) {
    const testId = i.test_id ?? (i.test_name ? matchName(created, i.test_name, (t) => t.name)?.id ?? null : null);
    await createTask(ctx, {
      title: i.title, description: i.description, category_id: catBySlug(ctx, i.category).id, priority: i.priority, status: "not_started",
      due_date: i.date, due_time: i.date ? i.time : null, estimated_minutes: i.estimated_minutes,
      project_id: i.project_id, milestone_id: null, test_id: testId, hackathon_id: i.hackathon_id,
      link_url: null, email_reminder: "default", source: "manual",
    });
    tasks++;
  }
  return { tasks, tests: testsCreated };
}

export { AIError };
