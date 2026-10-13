import { NextResponse } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { env, isAIConfigured } from "@/lib/env";
import { aiModel, generateJSON } from "@/lib/integrations/ai";

export const dynamic = "force-dynamic";

/** Signed-in diagnostic: makes one tiny AI call and reports the outcome (never the key). */
export async function GET(req: Request) {
  await getCtx(); // requires a session when Supabase is configured
  if (!isAIConfigured()) return NextResponse.json({ ok: false, provider: env.aiProvider, error: "AI not configured" });
  const url = new URL(req.url);
  if (url.searchParams.get("list") && env.aiProvider !== "anthropic") {
    // Lists model IDs available to this key (names only).
    const gem = env.aiProvider === "gemini";
    const base = env.aiBaseUrl || (gem ? "https://generativelanguage.googleapis.com/v1beta/openai" : "https://api.openai.com/v1");
    const res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${gem ? env.geminiKey : env.openaiKey}` }, cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    return NextResponse.json({ status: res.status, models: (j.data ?? []).map((m: { id: string }) => m.id) });
  }
  const started = Date.now();
  try {
    const r = await generateJSON(z.object({ reply: z.string() }), 'Return ONLY JSON: {"reply": "pong"}', "ping", 200);
    return NextResponse.json({ ok: true, provider: r.provider, model: r.model, reply: r.data.reply, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json({ ok: false, provider: env.aiProvider, model: aiModel(), error: e instanceof Error ? e.message : String(e), ms: Date.now() - started });
  }
}
