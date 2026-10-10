import "server-only";
import type { Ctx } from "../context";
import { todayIn } from "../dates";
import { isUnique } from "../db/types";
import { AIError, generateJSON } from "../integrations/ai";
import type { LearningTopic } from "../types";
import { learningSchema } from "../validation";

export const LEARNING_AREAS = [
  "Artificial Intelligence & ML",
  "Computer Science & Technology",
  "Psychology & Human Behaviour",
  "Business, Economics & Finance",
  "Science & Mathematics",
  "History & Philosophy",
  "Art, Design & Creativity",
  "Real-world Concepts & Discoveries",
];

export type LearningState =
  | { status: "ok"; topic: LearningTopic }
  | { status: "stale" | "fallback" | "not_configured"; topic: LearningTopic | FallbackTopic; error?: string };

export interface FallbackTopic extends Omit<LearningTopic, "id" | "user_id" | "created_at" | "provider" | "model"> {
  id: null;
  fallback: true;
}

export async function listLearning(ctx: Ctx) {
  return ctx.db.select<LearningTopic>("learning_topics", { eq: { user_id: ctx.userId } }, { order: [{ column: "generated_for", ascending: false }] });
}

export async function getTodayTopic(ctx: Ctx) {
  const [t] = await ctx.db.select<LearningTopic>("learning_topics", { eq: { user_id: ctx.userId, generated_for: todayIn(ctx.tz) } });
  return t ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
function tooSimilar(title: string, previous: string[]) {
  const a = new Set(norm(title));
  return previous.some((p) => {
    const b = new Set(norm(p));
    const inter = [...a].filter((w) => b.has(w)).length;
    const union = new Set([...a, ...b]).size || 1;
    return inter / union >= 0.5;
  });
}

function pickArea(history: LearningTopic[]) {
  // least recently covered area keeps the feed varied
  const lastSeen = new Map(LEARNING_AREAS.map((a) => [a, -1]));
  history.forEach((t, i) => {
    if (lastSeen.has(t.category) && lastSeen.get(t.category) === -1) lastSeen.set(t.category, i);
  });
  const never = LEARNING_AREAS.filter((a) => lastSeen.get(a) === -1);
  if (never.length) return never[Math.floor(Math.random() * never.length)];
  return [...lastSeen.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const SYSTEM = `You are Diva's daily learning writer for a curious computer-science university student.
Write one self-contained micro-lesson that teaches something genuinely interesting and accurate.
Return ONLY a JSON object with keys:
 "title" (specific, max 80 chars), "category" (exactly the requested area),
 "content" (190-230 words, 2-3 short paragraphs separated by \\n\\n, concrete example included, no markdown headings),
 "key_takeaway" (one sentence), "source_url" (a stable, real reference URL such as Wikipedia or an official site, or null if unsure),
 "further_reading" (0-3 objects {"title","url"} with real, stable URLs; omit anything you are not sure exists).`;

/** Returns today's topic, generating it at most once per calendar day (user timezone). */
export async function ensureTodayTopic(ctx: Ctx): Promise<LearningState> {
  const existing = await getTodayTopic(ctx);
  if (existing) return { status: "ok", topic: existing };

  const history = await listLearning(ctx);
  const today = todayIn(ctx.tz);
  try {
    const area = pickArea(history);
    const prevTitles = history.slice(0, 120).map((t) => t.title);
    const avoid = prevTitles.length ? `\nAlready covered (do NOT repeat or closely overlap): ${prevTitles.slice(0, 60).join(" | ")}` : "";
    let out = await generateJSON(learningSchema, SYSTEM, `Area: ${area}\nDate: ${today}${avoid}`, 1400);
    if (tooSimilar(out.data.title, prevTitles)) {
      out = await generateJSON(
        learningSchema,
        SYSTEM,
        `Area: ${area}\nDate: ${today}${avoid}\nYour first idea "${out.data.title}" overlaps a past topic. Pick a clearly different subject.`,
        1400,
      );
    }
    const d = out.data;
    try {
      const [topic] = await ctx.db.insert<LearningTopic>("learning_topics", {
        user_id: ctx.userId,
        title: d.title,
        category: LEARNING_AREAS.includes(d.category) ? d.category : area,
        content: d.content,
        key_takeaway: d.key_takeaway,
        source_url: d.source_url ?? null,
        further_reading: d.further_reading ?? [],
        generated_for: today,
        provider: out.provider,
        model: out.model,
      });
      return { status: "ok", topic };
    } catch (e) {
      if (isUnique(e)) {
        const t = await getTodayTopic(ctx); // another request won the race — use its topic
        if (t) return { status: "ok", topic: t };
      }
      throw e;
    }
  } catch (e) {
    const kind = e instanceof AIError ? e.kind : "provider";
    const message = e instanceof Error ? e.message : "Generation failed";
    if (history[0]) return { status: kind === "not_configured" ? "not_configured" : "stale", topic: history[0], error: message };
    return { status: kind === "not_configured" ? "not_configured" : "fallback", topic: fallbackTopic(today), error: message };
  }
}

export async function setTopicFlags(ctx: Ctx, id: string, patch: { is_read?: boolean; is_saved?: boolean }) {
  await ctx.db.update("learning_topics", { eq: { id, user_id: ctx.userId } }, patch);
}

// Clearly-labelled offline topics, shown only when nothing has ever been generated.
const FALLBACKS = [
  {
    title: "Spaced repetition: why cramming fades",
    category: "Psychology & Human Behaviour",
    content:
      "In the 1880s Hermann Ebbinghaus memorised nonsense syllables and measured how quickly he forgot them. The result, the forgetting curve, shows memory decaying steeply in the first day and then levelling off. Crucially, every time you successfully recall something just before you would have forgotten it, the curve flattens: the memory becomes more durable and the next review can wait longer.\n\nSpaced repetition turns this into a schedule. Instead of reading notes five times tonight, you review them tomorrow, then in three days, then a week, then a month. Apps such as Anki automate the intervals, but a paper list works too. The key ingredient is active recall: closing the book and trying to produce the answer, not re-reading it. Re-reading feels productive because the material looks familiar, yet familiarity is not the same as retrieval.\n\nFor exams, this means starting earlier with shorter sessions. Twenty minutes of recall spread over a week beats three hours the night before, and the knowledge survives long after the test.",
    key_takeaway: "Review just before you forget, and test yourself instead of re-reading.",
    source_url: "https://en.wikipedia.org/wiki/Spaced_repetition",
  },
  {
    title: "Big-O is about growth, not speed",
    category: "Computer Science & Technology",
    content:
      "Big-O notation describes how an algorithm's cost grows as the input grows, ignoring constant factors. An O(n) loop over a million items does roughly a million steps; an O(n²) nested loop does roughly a trillion. On ten items, the quadratic version might actually be faster because its constant work per step is smaller. Big-O tells you who wins eventually, not who wins today.\n\nThis is why engineers combine asymptotic thinking with measurement. A hash map lookup is O(1) on average, but hashing a long string still costs time, and a worst-case collision chain can degrade it to O(n). Binary search is O(log n), but only if the data is already sorted, and sorting is O(n log n).\n\nA practical habit: when you write a loop, ask what happens if the input becomes a thousand times larger. If the answer is 'a thousand times slower', you are linear. If it is 'a million times slower', look for a set, a map, sorting, or two pointers to remove the inner loop.",
    key_takeaway: "Big-O predicts how cost scales with input size; measure to know actual speed.",
    source_url: "https://en.wikipedia.org/wiki/Big_O_notation",
  },
  {
    title: "Opportunity cost: the price of the road not taken",
    category: "Business, Economics & Finance",
    content:
      "Every choice has a hidden price: the value of the best alternative you gave up. Economists call this opportunity cost. Spending a Saturday on a hackathon costs nothing in rupees, but it costs the rest, the paid shift, or the revision you could have done. Thinking in opportunity costs makes trade-offs visible instead of pretending choices are free.\n\nThe idea explains many real decisions. A company keeps cash in a low-interest account; the opportunity cost is the return it could earn by investing it. A student takes a gap year; the cost includes a year of salary later in life. Even time spent on a 'free' app has a cost measured in attention you could have spent elsewhere.\n\nThe concept also guards against the sunk-cost fallacy. Money or effort already spent cannot be recovered, so it should not drive the next decision. The right question is always forward-looking: from here, which option gives the most value compared with its best alternative?",
    key_takeaway: "The true cost of a choice is the best alternative you give up.",
    source_url: "https://en.wikipedia.org/wiki/Opportunity_cost",
  },
];

export function fallbackTopic(date: string): FallbackTopic {
  const i = Math.abs([...date].reduce((a, c) => a + c.charCodeAt(0), 0)) % FALLBACKS.length;
  return { ...FALLBACKS[i], id: null, fallback: true, further_reading: [], generated_for: date, is_read: false, is_saved: false };
}
