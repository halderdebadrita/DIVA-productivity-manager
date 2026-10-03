import "server-only";

// Central, server-only view of configuration. Nothing here is ever sent to the client
// except the boolean "configured" flags returned by integrationStatus().

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  aiProvider: (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "anthropic")).toLowerCase() as "anthropic" | "openai" | "gemini",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  openaiKey: process.env.OPENAI_API_KEY || "",
  geminiKey: process.env.GEMINI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "",
  aiFallbackModel: process.env.AI_FALLBACK_MODEL || "",
  aiBaseUrl: process.env.AI_BASE_URL || "",
  resendKey: process.env.RESEND_API_KEY || "",
  resendUrl: (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, ""),
  emailFrom: process.env.EMAIL_FROM || "",
  cronSecret: process.env.CRON_SECRET || "",
  githubToken: process.env.GITHUB_TOKEN || "",
  githubApiUrl: (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, ""),
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  defaultTimezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  demoEmail: process.env.DEMO_REMINDER_EMAIL || "",
};

export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isAIConfigured = () =>
  env.aiProvider === "openai" ? Boolean(env.openaiKey) : env.aiProvider === "gemini" ? Boolean(env.geminiKey) : Boolean(env.anthropicKey);
export const isEmailConfigured = () => Boolean(env.resendKey && env.emailFrom);

export function integrationStatus() {
  return {
    mode: isSupabaseConfigured() ? ("supabase" as const) : ("demo" as const),
    supabase: isSupabaseConfigured(),
    serviceRole: Boolean(env.supabaseServiceRoleKey),
    ai: isAIConfigured(),
    aiProvider: env.aiProvider,
    aiModel: env.aiModel || null,
    email: isEmailConfigured(),
    cron: Boolean(env.cronSecret),
    github: Boolean(env.githubToken),
  };
}
export type IntegrationStatus = ReturnType<typeof integrationStatus>;
