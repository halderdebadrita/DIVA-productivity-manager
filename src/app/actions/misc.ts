"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { resourceLinkInput, reminderPrefsInput } from "@/lib/validation";
import { createLinkResource, deleteResource, uploadResource } from "@/lib/services/resources";
import { ensureTodayTopic, setTopicFlags } from "@/lib/services/learning";
import { completeQuest, generateQuest, questToTask, startQuest } from "@/lib/services/side-quests";
import { acknowledgeReminder, syncAllReminders } from "@/lib/services/reminders";
import { retryReminder, runForCtx } from "@/lib/services/dispatch";
import { searchAll } from "@/lib/services/search";
import { isSupabaseConfigured } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { resetLocalStore } from "@/lib/db/local";
import { wipeUserData } from "@/lib/services/wipe";
import { run } from "./_run";

// ---- Resources
export async function addLinkResourceAction(raw: unknown) {
  return run((ctx) => createLinkResource(ctx, resourceLinkInput.parse(raw)));
}
export async function uploadResourceAction(form: FormData) {
  return run(async (ctx) => {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file to upload");
    const s = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const entity_type = z.enum(["test", "hackathon", "project", "study"]).nullable().parse(s("entity_type"));
    return uploadResource(ctx, file, {
      title: s("title") ?? file.name,
      kind: s("kind") ?? "other",
      subject: s("subject"),
      description: s("description"),
      entity_type,
      entity_id: s("entity_id"),
      section: s("section"),
    });
  });
}
export async function deleteResourceAction(id: string) {
  return run((ctx) => deleteResource(ctx, id));
}

// ---- Learning
export async function generateLearningAction() {
  return run((ctx) => ensureTodayTopic(ctx), { revalidate: false });
}
export async function markTopicAction(id: string, flags: { is_read?: boolean; is_saved?: boolean }) {
  return run((ctx) => setTopicFlags(ctx, id, z.object({ is_read: z.boolean().optional(), is_saved: z.boolean().optional() }).parse(flags)));
}

// ---- Side quests
export async function newQuestAction() {
  return run((ctx) => generateQuest(ctx));
}
export async function startQuestAction(id: string) {
  return run((ctx) => startQuest(ctx, id));
}
export async function completeQuestAction(id: string) {
  return run((ctx) => completeQuest(ctx, id));
}
export async function questToTaskAction(id: string) {
  return run((ctx) => questToTask(ctx, id));
}

// ---- Reminders
export async function acknowledgeAction(entityType: string, entityId: string, eventDate: string) {
  return run((ctx) =>
    acknowledgeReminder(ctx, z.enum(["task", "test", "project", "milestone", "hackathon"]).parse(entityType), entityId, eventDate),
  );
}
export async function retryReminderAction(id: string) {
  return run((ctx) => retryReminder(ctx, id));
}
export async function saveReminderPrefsAction(raw: unknown) {
  return run(async (ctx) => {
    const prefs = reminderPrefsInput.parse(raw);
    await ctx.db.update("profiles", { eq: { id: ctx.userId } }, { reminder_prefs: prefs });
    // Re-derive every reminder under the new preferences
    const next = { ...ctx, prefs, reminderEmail: prefs.email || ctx.profile.email };
    await syncAllReminders(next);
  });
}
/** Explicit "process due reminders now" from Settings (same code path as the scheduler, for this user only). */
export async function runRemindersNowAction() {
  return run((ctx) => runForCtx(ctx));
}

// ---- Profile & categories
export async function saveProfileAction(raw: unknown) {
  return run(async (ctx) => {
    const p = z
      .object({
        display_name: z.string().trim().min(1, "Add your name").max(60),
        timezone: z.string().refine((tz) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        }, "Unknown timezone"),
      })
      .parse(raw);
    await ctx.db.update("profiles", { eq: { id: ctx.userId } }, p);
    await syncAllReminders({ ...ctx, tz: p.timezone });
  });
}
export async function saveCategoryAction(id: string, raw: unknown) {
  return run(async (ctx) => {
    const c = z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour") }).parse(raw);
    await ctx.db.update("categories", { eq: { id, user_id: ctx.userId } }, c);
  });
}

// ---- Search
export async function searchAction(q: string) {
  return run((ctx) => searchAll(ctx, z.string().max(100).parse(q)), { revalidate: false });
}

// ---- Auth / demo
export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const s = await supabaseServer();
    await s.auth.signOut();
  }
  redirect("/login");
}
export async function resetDemoAction() {
  return run(async (ctx) => {
    if (ctx.mode !== "demo") throw new Error("Only available in demo mode");
    await resetLocalStore();
    (globalThis as unknown as { __divaSeed?: Promise<void> }).__divaSeed = undefined;
  });
}

export async function wipeDataAction(opts: { learning?: boolean }) {
  return run((ctx) => wipeUserData(ctx, { learning: Boolean(opts?.learning) }));
}

export async function saveQuickLinksAction(raw: Record<string, string>) {
  return run(async (ctx) => {
    const { QUICK_LINK_DEFS } = await import("@/lib/quick-links");
    const clean: Record<string, string> = {};
    for (const d of QUICK_LINK_DEFS) {
      const v = (raw[d.key] ?? "").trim();
      if (v && !/^https?:\/\/[^\s]+$/i.test(v)) throw new Error(`${d.label}: enter a full link starting with https://`);
      clean[d.key] = v;
    }
    await ctx.db.update("profiles", { eq: { id: ctx.userId } }, { preferences: { ...(ctx.profile.preferences ?? {}), quick_links: clean } });
  });
}

// ---- "Tell Diva" assistant
export async function assistantPlanAction(text: string) {
  return run(
    async (ctx) => {
      const { planFromText, planWithoutAI } = await import("@/lib/services/assistant");
      const msg = z.string().max(4000).parse(text);
      try {
        const r = await planFromText(ctx, msg);
        return { ...r, fallback: false as const, error: null };
      } catch (e) {
        if (e instanceof Error && e.message === "Type what you need to do first") throw e;
        return {
          reply: "I couldn't reach the AI just now, so I split your message into undated tasks — set dates below or try again in a minute.",
          items: planWithoutAI(msg),
          model: null,
          fallback: true as const,
          error: e instanceof Error ? e.message.slice(0, 200) : "AI unavailable",
        };
      }
    },
    { revalidate: false },
  );
}
export async function assistantCommitAction(items: unknown) {
  return run(async (ctx) => {
    const { commitPlan } = await import("@/lib/services/assistant");
    return commitPlan(ctx, items);
  });
}
