import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client: ONLY for the scheduled reminder job. Never import from client code. */
export function supabaseAdmin() {
  if (!env.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
