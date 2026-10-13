import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { DEFAULT_CATEGORIES, DEFAULT_REMINDER_PREFS } from "./constants";
import { env, isSupabaseConfigured } from "./env";
import { localDb, localFiles } from "./db/local";
import { supabaseDb, supabaseFiles } from "./db/supabase";
import type { Db, FileStore } from "./db/types";
import { supabaseServer } from "./supabase/server";
import type { Category, Profile, ReminderPrefs } from "./types";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export interface Ctx {
  db: Db;
  files: FileStore;
  userId: string;
  mode: "supabase" | "demo";
  profile: Profile;
  categories: Category[];
  tz: string;
  prefs: ReminderPrefs;
  /** Address reminder emails go to (null => email disabled / unknown) */
  reminderEmail: string | null;
}

export function buildCtx(base: { db: Db; files: FileStore; userId: string; mode: Ctx["mode"] }, profile: Profile, categories: Category[]): Ctx {
  const prefs = { ...DEFAULT_REMINDER_PREFS, ...(profile.reminder_prefs ?? {}) } as ReminderPrefs;
  const email = prefs.email || profile.email || (base.mode === "demo" ? env.demoEmail || null : null);
  return {
    ...base,
    profile,
    categories: [...categories].sort((a, b) => a.sort_order - b.sort_order),
    tz: profile.timezone || env.defaultTimezone,
    prefs,
    reminderEmail: email,
  };
}

export async function ensureCategories(db: Db, userId: string) {
  let cats = await db.select<Category>("categories", { eq: { user_id: userId } });
  const missing = DEFAULT_CATEGORIES.filter((d) => !cats.some((c) => c.slug === d.slug));
  if (missing.length) {
    try {
      await db.insert("categories", missing.map((m) => ({ ...m, user_id: userId })));
    } catch {
      /* concurrent insert — fine */
    }
    cats = await db.select<Category>("categories", { eq: { user_id: userId } });
  }
  return cats;
}

async function ensureProfile(db: Db, userId: string, email: string | null): Promise<Profile> {
  const [existing] = await db.select<Profile>("profiles", { eq: { id: userId } });
  if (existing) return existing;
  try {
    const [p] = await db.insert<Profile>("profiles", {
      id: userId,
      email,
      display_name: email ? email.split("@")[0] : "there",
      timezone: env.defaultTimezone,
    });
    return p;
  } catch {
    const [p] = await db.select<Profile>("profiles", { eq: { id: userId } });
    return p;
  }
}

/** Resolves the signed-in user (or the demo user) once per request. */
export const getCtx = cache(async (): Promise<Ctx> => {
  if (isSupabaseConfigured()) {
    const client = await supabaseServer();
    const { data } = await client.auth.getUser();
    if (!data.user) redirect("/login");
    const db = supabaseDb(client);
    const profile = await ensureProfile(db, data.user.id, data.user.email ?? null);
    const categories = await ensureCategories(db, data.user.id);
    return buildCtx({ db, files: supabaseFiles(client), userId: data.user.id, mode: "supabase" }, profile, categories);
  }

  const db = localDb();
  const gl = globalThis as unknown as { __divaSeed?: Promise<void> };
  gl.__divaSeed ??= (async () => {
    const [existing] = await db.select<Profile>("profiles", { eq: { id: DEMO_USER_ID } });
    if (existing) return;
    await db.insert("profiles", {
      id: DEMO_USER_ID,
      email: env.demoEmail || null,
      display_name: "Debadrita",
      timezone: env.defaultTimezone,
    });
    const cats = await ensureCategories(db, DEMO_USER_ID);
    // Starts empty. Sample data only when explicitly requested with DIVA_DEMO_SEED=1.
    if (process.env.DIVA_DEMO_SEED === "1") {
      const [p] = await db.select<Profile>("profiles", { eq: { id: DEMO_USER_ID } });
      const { seedDemo } = await import("./demo-seed");
      await seedDemo(buildCtx({ db, files: localFiles(), userId: DEMO_USER_ID, mode: "demo" }, p, cats));
    }
  })().catch((e) => {
    gl.__divaSeed = undefined;
    throw e;
  });
  await gl.__divaSeed;
  const [profile] = await db.select<Profile>("profiles", { eq: { id: DEMO_USER_ID } });
  const categories = await ensureCategories(db, DEMO_USER_ID);
  return buildCtx({ db, files: localFiles(), userId: DEMO_USER_ID, mode: "demo" }, profile, categories);
});

export const catBySlug = (ctx: Ctx, slug: string) =>
  ctx.categories.find((c) => c.slug === slug) ?? ctx.categories.find((c) => c.slug === "other")!;
