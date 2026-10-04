"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    if (!email || password.length < 8) return setMsg({ tone: "error", text: "Enter your email and a password of at least 8 characters." });
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    const res =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (res.error) return setMsg({ tone: "error", text: res.error.message });
    if (mode === "signup" && !res.data.session) return setMsg({ tone: "info", text: "Check your inbox to confirm your email, then sign in." });
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card card-pad space-y-4">
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={8} /></Field>
      {msg && <p className={msg.tone === "error" ? "text-sm text-danger" : "text-sm text-ok"} role="alert">{msg.text}</p>}
      <Button type="submit" variant="primary" className="w-full" loading={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
      <button type="button" className="w-full text-center text-xs text-muted hover:text-fg" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "First time? Create your account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
