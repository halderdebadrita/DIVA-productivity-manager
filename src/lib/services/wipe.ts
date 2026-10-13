import "server-only";
import type { Ctx } from "../context";
import type { Resource } from "../types";

/**
 * Deletes every record you created (tasks, tests, projects + milestones, hackathons,
 * files/links, side quests, reminders and GitHub snapshots). Your profile, settings,
 * categories and — unless asked — your daily learning history are kept.
 */
export async function wipeUserData(ctx: Ctx, opts: { learning?: boolean } = {}) {
  const u = { eq: { user_id: ctx.userId } };
  const files = await ctx.db.select<Resource>("resources", u);
  const counts: Record<string, number> = {};
  // order matters for foreign keys: children first
  for (const t of ["reminders", "side_quests", "tasks", "resources", "github_snapshots", "project_milestones", "projects", "tests", "hackathons"] as const) {
    counts[t] = await ctx.db.remove(t, u);
  }
  if (opts.learning) counts.learning_topics = await ctx.db.remove("learning_topics", u);
  await ctx.files.remove(files.map((f) => f.storage_path).filter(Boolean) as string[]);
  return counts;
}
