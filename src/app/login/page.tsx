import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { DivaMark } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const s = await supabaseServer();
    const { data } = await s.auth.getUser();
    if (data.user) redirect("/dashboard");
  }
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <DivaMark className="size-9" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Diva</h1>
            <p className="text-xs text-muted">Your personal command centre</p>
          </div>
        </div>
        {configured ? (
          <LoginForm />
        ) : (
          <div className="card card-pad space-y-3">
            <p className="text-sm font-medium">Authentication isn&apos;t configured yet</p>
            <p className="text-sm text-muted">
              Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code className="font-mono text-xs">.env.local</code> to enable sign-in. Until then Diva runs in demo mode with local sample data.
            </p>
            <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg">Open demo</Link>
          </div>
        )}
      </div>
    </main>
  );
}
