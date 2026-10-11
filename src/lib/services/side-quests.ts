import "server-only";
import { catBySlug, type Ctx } from "../context";
import { addDays, todayIn } from "../dates";
import { AIError, generateJSON } from "../integrations/ai";
import type { Project, SideQuest, Test } from "../types";
import { sideQuestSchema } from "../validation";
import { createTask, setTaskDone } from "./tasks";

export const listQuests = (ctx: Ctx) =>
  ctx.db.select<SideQuest>("side_quests", { eq: { user_id: ctx.userId } }, { order: [{ column: "created_at", ascending: false }] });

export async function featuredQuest(ctx: Ctx) {
  const qs = await listQuests(ctx);
  return {
    current: qs.find((q) => q.status === "suggested" || q.status === "active") ?? null,
    completed: qs.filter((q) => q.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  };
}

const SYSTEM = `You suggest one "side quest" for a computer-science university student who has about an hour free.
A side quest is small, concrete, achievable in 30-75 minutes and leaves a visible result.
Prefer quests that connect to the student's real projects or upcoming tests when given, but vary the type.
Return ONLY a JSON object: {"title": short imperative, "description": 1-3 sentences on what to do and why,
"category": one of ["Learning","Projects","Academics","Personal","Creative"], "estimated_minutes": integer 30-75,
"completion_criterion": one sentence starting with "Done when"}.`;

const FALLBACK_QUESTS = [
  { title: "Solve two medium DSA problems", description: "Pick two medium problems on a topic you find shaky (graphs, DP or sliding window). Write the brute force first, then optimise.", category: "Learning", estimated_minutes: 60, completion_criterion: "Done when both solutions pass all test cases and you've noted the time complexity of each." },
  { title: "Read one technical article, write three takeaways", description: "Choose an engineering blog post or paper summary related to something you're building. Read it actively.", category: "Learning", estimated_minutes: 45, completion_criterion: "Done when three takeaways and one open question are written in your notes." },
  { title: "Polish one README", description: "Open your most visible GitHub repo and improve its README: one-line pitch, screenshot, setup steps and tech stack.", category: "Projects", estimated_minutes: 45, completion_criterion: "Done when a stranger could clone and run the project using only the README." },
  { title: "Close one small issue in a project", description: "Pick the smallest open bug or TODO in an active project and fix it end to end, including a commit with a clear message.", category: "Projects", estimated_minutes: 60, completion_criterion: "Done when the fix is committed and pushed." },
  { title: "Make a one-page summary of a subject", description: "Choose the subject with your nearest test and condense one unit into a single page of definitions, formulas and examples.", category: "Academics", estimated_minutes: 60, completion_criterion: "Done when the one-page summary exists and covers every heading in the unit." },
  { title: "Learn one new concept and explain it", description: "Pick a concept you've heard of but can't explain (e.g. CRDTs, Bloom filters, attention). Learn it and explain it in 150 words.", category: "Learning", estimated_minutes: 50, completion_criterion: "Done when your 150-word explanation includes one example." },
  { title: "Organise a project's documentation", description: "Collect scattered notes, links and decisions for one project into a single docs page in Diva or your repo.", category: "Projects", estimated_minutes: 45, completion_criterion: "Done when one page lists architecture, decisions and links for the project." },
  { title: "Sketch for an hour", description: "Spend an hour on a creative practice — sketching, UI doodles, or redrawing an interface you admire.", category: "Creative", estimated_minutes: 60, completion_criterion: "Done when you have at least three finished sketches." },
];

const QUEST_CAT_TO_SLUG: Record<string, string> = { Learning: "learning", Projects: "projects", Academics: "academics", Personal: "personal", Creative: "personal" };

export async function generateQuest(ctx: Ctx): Promise<{ quest: SideQuest; error?: string }> {
  // Replace the currently suggested (not started) quest
  const all = await listQuests(ctx);
  for (const q of all.filter((x) => x.status === "suggested")) {
    await ctx.db.update("side_quests", { eq: { id: q.id, user_id: ctx.userId } }, { status: "skipped" });
  }
  const recent = all.slice(0, 15).map((q) => q.title);
  const today = todayIn(ctx.tz);
  try {
    const [projects, tests] = await Promise.all([
      ctx.db.select<Project>("projects", { eq: { user_id: ctx.userId } }),
      ctx.db.select<Test>("tests", { eq: { user_id: ctx.userId } }),
    ]);
    const active = projects.filter((p) => p.status === "in_progress" || p.status === "planning").slice(0, 5);
    const soon = tests.filter((t) => t.test_date >= today && t.test_date <= addDays(today, 21)).slice(0, 5);
    const context = [
      active.length ? `Active projects: ${active.map((p) => `${p.name}${p.tech_stack.length ? ` (${p.tech_stack.join(", ")})` : ""}`).join("; ")}` : "No active projects listed.",
      soon.length ? `Upcoming tests: ${soon.map((t) => `${t.subject} ${t.type} on ${t.test_date}`).join("; ")}` : "No tests in the next three weeks.",
      recent.length ? `Recent quests to avoid repeating: ${recent.join(" | ")}` : "",
      `Seed: ${Math.random().toString(36).slice(2, 7)}`,
    ].join("\n");
    const { data } = await generateJSON(sideQuestSchema, SYSTEM, context, 500);
    const [quest] = await ctx.db.insert<SideQuest>("side_quests", { ...data, user_id: ctx.userId, source: "ai", status: "suggested" });
    return { quest };
  } catch (e) {
    const pool = FALLBACK_QUESTS.filter((q) => !recent.includes(q.title));
    const pick = (pool.length ? pool : FALLBACK_QUESTS)[Math.floor(Math.random() * (pool.length || FALLBACK_QUESTS.length))];
    const [quest] = await ctx.db.insert<SideQuest>("side_quests", { ...pick, user_id: ctx.userId, source: "fallback", status: "suggested" });
    return { quest, error: e instanceof AIError ? e.message : "AI generation failed" };
  }
}

async function getQuest(ctx: Ctx, id: string) {
  const [q] = await ctx.db.select<SideQuest>("side_quests", { eq: { id, user_id: ctx.userId } });
  if (!q) throw new Error("Side quest not found");
  return q;
}

export async function startQuest(ctx: Ctx, id: string) {
  await getQuest(ctx, id);
  await ctx.db.update("side_quests", { eq: { id, user_id: ctx.userId } }, { status: "active", started_at: new Date().toISOString() });
}

export async function completeQuest(ctx: Ctx, id: string) {
  const q = await getQuest(ctx, id);
  await ctx.db.update("side_quests", { eq: { id, user_id: ctx.userId } }, { status: "completed", completed_at: new Date().toISOString() });
  if (q.task_id) await setTaskDone(ctx, q.task_id, true).catch(() => undefined);
}

/** Turns a quest into a real task only when the user asks. */
export async function questToTask(ctx: Ctx, id: string) {
  const q = await getQuest(ctx, id);
  if (q.task_id) return q.task_id;
  const { task } = await createTask(ctx, {
    title: q.title,
    description: `${q.description}\n\n${q.completion_criterion}`,
    category_id: catBySlug(ctx, QUEST_CAT_TO_SLUG[q.category] ?? "learning").id,
    priority: "low",
    status: q.status === "active" ? "in_progress" : "not_started",
    due_date: todayIn(ctx.tz),
    due_time: null,
    estimated_minutes: q.estimated_minutes,
    project_id: null,
    milestone_id: null,
    test_id: null,
    hackathon_id: null,
    link_url: null,
    email_reminder: "off",
    source: "side_quest",
    source_key: `side_quest:${q.id}`,
  });
  await ctx.db.update("side_quests", { eq: { id, user_id: ctx.userId } }, { task_id: task.id });
  return task.id;
}
