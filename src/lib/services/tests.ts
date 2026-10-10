import "server-only";
import type { Ctx } from "../context";
import type { Test } from "../types";
import { syncEntityReminders } from "./reminders";
import { deleteResourcesFor } from "./resources";

export const listTests = (ctx: Ctx) =>
  ctx.db.select<Test>("tests", { eq: { user_id: ctx.userId } }, { order: [{ column: "test_date" }, { column: "test_time" }] });

export async function createTest(ctx: Ctx, input: Record<string, unknown>) {
  const [t] = await ctx.db.insert<Test>("tests", { ...input, user_id: ctx.userId });
  await syncEntityReminders(ctx, "test", t.id);
  return t;
}

export async function updateTest(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  const [t] = await ctx.db.update<Test>("tests", { eq: { id, user_id: ctx.userId } }, patch);
  if (!t) throw new Error("Test not found");
  await syncEntityReminders(ctx, "test", id);
  return t;
}

/** Deletion policy: the test, its reminders and its study resources (incl. files) are removed; linked tasks are kept but unlinked. */
export async function deleteTest(ctx: Ctx, id: string) {
  await deleteResourcesFor(ctx, "test", id);
  await ctx.db.remove("tests", { eq: { id, user_id: ctx.userId } });
  await syncEntityReminders(ctx, "test", id);
}
