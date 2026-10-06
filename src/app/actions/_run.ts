import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { getCtx, type Ctx } from "@/lib/context";
import { DbError } from "@/lib/db/types";
import { firstError } from "@/lib/validation";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Wraps a server action: resolves the user, maps errors to friendly messages, refreshes every view. */
export async function run<T>(fn: (ctx: Ctx) => Promise<T>, opts: { revalidate?: boolean } = {}): Promise<Result<T>> {
  try {
    const ctx = await getCtx();
    const data = await fn(ctx);
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ZodError) return { ok: false, error: firstError(e) };
    if (e instanceof DbError && e.code === "fk") return { ok: false, error: "That item is still referenced elsewhere." };
    console.error("[diva action]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
