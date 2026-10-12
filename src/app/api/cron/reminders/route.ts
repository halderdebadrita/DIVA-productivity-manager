import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env, isSupabaseConfigured } from "@/lib/env";
import { runReminderJob } from "@/lib/services/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled reminder processor. Call it every 15–60 minutes from any scheduler
 * (Vercel Cron, Supabase pg_cron + pg_net, GitHub Actions, or `npm run reminders`):
 *   GET /api/cron/reminders   with header  Authorization: Bearer $CRON_SECRET
 * Idempotent: running it twice in parallel cannot send an email twice.
 */
function authorised(req: Request) {
  if (!env.cronSecret) return !isSupabaseConfigured(); // demo mode may run unauthenticated locally
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${env.cronSecret}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function handle(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const reports = await runReminderJob();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), reports });
  } catch (e) {
    console.error("[cron reminders]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
