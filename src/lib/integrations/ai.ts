import "server-only";
import type { z } from "zod";
import { env, isAIConfigured } from "../env";

/**
 * Provider-agnostic JSON generation. Swap providers/models with env vars:
 *   AI_PROVIDER=anthropic|openai|gemini, AI_MODEL=..., ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY,
 *   AI_BASE_URL (optional, for OpenAI-compatible gateways).
 * Output is always validated against a zod schema before it is used or stored.
 */

export class AIError extends Error {
  constructor(message: string, public kind: "not_configured" | "provider" | "invalid_output" | "timeout", public status?: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Overloaded/timeouts are worth one quick retry. 429 (rate/quota) is not — retrying burns more quota,
// so we move straight to the next model (free-tier quotas are per model).
const transient = (e: unknown) => e instanceof AIError && (e.kind === "timeout" || (e.status ?? 0) >= 500);
const tryNextModel = (e: unknown) => e instanceof AIError && (transient(e) || e.status === 429 || e.status === 404);

/**
 * Calls the configured model, retrying busy/overloaded responses (429, 5xx, timeouts)
 * with backoff, then trying AI_FALLBACK_MODEL (if set) before giving up.
 */
async function callProvider(system: string, user: string, maxTokens: number): Promise<{ text: string; model: string }> {
  const builtIn = env.aiProvider === "gemini" && !env.aiModel ? ["gemini-3.7-flash", "gemini-3.8-flash"] : [];
  const models = Array.from(new Set([aiModel(), ...(env.aiFallbackModel ? env.aiFallbackModel.split(",").map((m) => m.trim()) : builtIn)]));
  let last: unknown;
  for (const model of models) {
    for (const wait of [0, 1200]) {
      if (wait) await sleep(wait);
      try {
        return { text: await callOnce(model, system, user, maxTokens), model };
      } catch (e) {
        last = e;
        if (!transient(e)) break; // 400/401/404/429 — retrying the same model won't help
      }
    }
    if (!tryNextModel(last)) break; // e.g. bad key (401): other models won't help either
  }
  throw last;
}

const DEFAULT_MODELS = { anthropic: "claude-sonnet-5-5", openai: "gpt-4.1-mini", gemini: "gemini-3.5-flash" };

export const aiModel = () => env.aiModel || DEFAULT_MODELS[env.aiProvider] || DEFAULT_MODELS.anthropic;

async function callOnce(model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const signal = AbortSignal.timeout(45_000);
  try {
    if (env.aiProvider === "openai" || env.aiProvider === "gemini") {
      // Gemini is called through Google's official OpenAI-compatible endpoint.
      const gemini = env.aiProvider === "gemini";
      const base = env.aiBaseUrl || (gemini ? "https://generativelanguage.googleapis.com/v1beta/openai" : "https://api.openai.com/v1");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${gemini ? env.geminiKey : env.openaiKey}` },
        body: JSON.stringify({
          model,
          // Gemini 2.5 models spend part of the budget on internal "thinking" — leave headroom.
          max_tokens: gemini ? maxTokens + 4000 : maxTokens,
          temperature: 0.9,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new AIError(`AI provider error ${res.status}: ${(await res.text()).slice(0, 200)}`, "provider", res.status);
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? "";
    }
    const res = await fetch(`${env.aiBaseUrl || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": env.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new AIError(`AI provider error ${res.status}: ${(await res.text()).slice(0, 200)}`, "provider", res.status);
    const json = await res.json();
    return (json.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AIError("The AI request timed out", "timeout");
    throw new AIError(`Could not reach the AI provider: ${e instanceof Error ? e.message : String(e)}`, "provider");
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

export async function generateJSON<S extends z.ZodTypeAny>(
  schema: S,
  system: string,
  user: string,
  maxTokens = 1200,
): Promise<{ data: z.infer<S>; provider: string; model: string }> {
  if (!isAIConfigured()) throw new AIError("AI is not configured", "not_configured");
  let prompt = user;
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, model } = await callProvider(system, prompt, maxTokens);
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return { data: parsed.data, provider: env.aiProvider, model };
      lastErr = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "unparseable output";
    }
    prompt = `${user}\n\nYour previous answer was rejected (${lastErr}). Return ONLY a valid JSON object matching the schema.`;
  }
  throw new AIError(`AI returned invalid output: ${lastErr}`, "invalid_output");
}
