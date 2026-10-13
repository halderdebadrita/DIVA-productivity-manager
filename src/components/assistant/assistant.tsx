"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUp, CalendarDays, Check, GraduationCap, Link2, ListChecks, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt, relativeDay } from "@/lib/dates";
import { assistantCommitAction, assistantPlanAction } from "@/app/actions/misc";
import { useApp } from "@/components/shell/app-provider";

type Item = {
  kind: "task" | "test";
  title: string;
  date: string | null;
  time: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimated_minutes: number | null;
  description: string | null;
  project_id: string | null;
  test_id: string | null;
  hackathon_id: string | null;
  test_type: "theory" | "practical" | null;
  subject: string | null;
  link_label: string | null;
  test_name: string | null;
};
type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string; items?: (Item & { keep: boolean })[]; committed?: string; fallback?: boolean; model?: string | null };

const EXAMPLES = [
  "DBMS assignment due friday 5pm, OS lab practical on the 20th at 2, revise semaphores before it",
  "pay hostel fees tomorrow, call mom sunday evening, finish portfolio README this week",
];

const PRIO = { urgent: "Urgent", high: "High", medium: "Med", low: "Low" } as const;

export function AssistantBubble() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [, start] = useTransition();
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    if (!thinking) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [thinking]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = (value?: string) => {
    const msg = (value ?? text).trim();
    if (!msg || thinking) return;
    setText("");
    setMsgs((m) => [...m, { id: idRef.current++, role: "user", text: msg }]);
    setThinking(true);
    start(async () => {
      const r = await assistantPlanAction(msg);
      setThinking(false);
      if (!r.ok) {
        setMsgs((m) => [...m, { id: idRef.current++, role: "assistant", text: r.error }]);
        return;
      }
      setMsgs((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "assistant",
          text: r.data.items.length ? r.data.reply : r.data.reply || "I couldn't find anything to add — try describing tasks with what and when.",
          items: r.data.items.map((i) => ({ ...i, keep: true })),
          fallback: r.data.fallback,
          model: r.data.model,
        },
      ]);
    });
  };

  const updateItem = (msgId: number, idx: number, patch: Partial<Item & { keep: boolean }>) =>
    setMsgs((m) => m.map((x) => (x.id === msgId && x.role === "assistant" && x.items ? { ...x, items: x.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : x)));

  const commit = (msgId: number) => {
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg || msg.role !== "assistant" || !msg.items) return;
    const chosen = msg.items.filter((i) => i.keep && i.title.trim());
    if (!chosen.length) return toast.error("Select at least one item");
    start(async () => {
      const r = await assistantCommitAction(
        chosen.map(({ keep: _keep, link_label: _l, ...i }) => ({ ...i, title: i.title.trim(), date: i.date || null, time: i.date ? i.time || null : null })),
      );
      if (!r.ok) return void toast.error(r.error);
      const parts = [r.data.tasks && `${r.data.tasks} task${r.data.tasks > 1 ? "s" : ""}`, r.data.tests && `${r.data.tests} test${r.data.tests > 1 ? "s" : ""}`].filter(Boolean);
      setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, committed: `Added ${parts.join(" and ")}` } : x)));
      toast.success(`Added ${parts.join(" and ")} to Diva`);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Diva assistant" : "Open Diva assistant (Ctrl+J)"}
        aria-expanded={open}
        title="Tell Diva what's on your plate (Ctrl+J)"
        className={cn(
          "fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-black/40 transition-transform hover:scale-105",
          open && "scale-95",
        )}
      >
        {open ? <X className="size-5" /> : (
          <span className="relative">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.1A8.5 8.5 0 1 1 21 12Z" />
            </svg>
            <Sparkles className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2" />
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Diva assistant"
          className="fixed inset-x-2 bottom-20 top-16 z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/60 sm:inset-x-auto sm:right-5 sm:top-auto sm:h-[min(620px,calc(100dvh-7rem))] sm:w-[420px]"
        >
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent"><Sparkles className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Tell Diva</p>
              <p className="text-2xs text-subtle">{app.integrations.ai ? "Type anything — I'll sort it by date and category" : "AI not configured — I'll still capture your list"}</p>
            </div>
            {msgs.length > 0 && <button onClick={() => setMsgs([])} className="rounded px-2 py-1 text-2xs text-subtle hover:bg-surface-2 hover:text-fg">Clear</button>}
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {msgs.length === 0 && (
              <div className="px-1">
                <p className="text-sm text-muted">Dump everything on your mind in one go. I&apos;ll turn it into dated, categorised tasks and tests — you review before anything is saved.</p>
                <p className="mt-3 eyebrow">Try</p>
                <div className="mt-1.5 space-y-1.5">
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => send(e)} className="block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-[13px] text-muted hover:border-border-strong hover:text-fg">
                      “{e}”
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-10 rounded-2xl rounded-br-md bg-accent/15 px-3.5 py-2 text-[13.5px] whitespace-pre-wrap">{m.text}</div>
              ) : (
                <div key={m.id} className="mr-2 space-y-2">
                  <div className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[13.5px]">{m.text}</div>
                  {m.items && m.items.length > 0 && (
                    <div className={cn("rounded-xl border border-border", m.committed && "opacity-70")}>
                      <ul className="divide-y divide-border/60">
                        {m.items.map((it, idx) => {
                          const cat = app.catBySlug(it.category);
                          return (
                            <li key={idx} className={cn("space-y-1.5 px-3 py-2.5", !it.keep && "opacity-45")}>
                              <div className="flex items-start gap-2">
                                <input type="checkbox" checked={it.keep} disabled={!!m.committed} onChange={(e) => updateItem(m.id, idx, { keep: e.target.checked })} aria-label={`Include ${it.title}`} className="mt-1 accent-[rgb(214,255,112)]" />
                                <input value={it.title} disabled={!!m.committed} onChange={(e) => updateItem(m.id, idx, { title: e.target.value })} aria-label="Title" className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium outline-none focus:underline" />
                                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-2xs", it.kind === "test" ? "bg-warn/15 text-warn" : "bg-surface-3 text-muted")}>
                                  {it.kind === "test" ? <GraduationCap className="size-3" /> : <ListChecks className="size-3" />}{it.kind === "test" ? `${it.test_type ?? "theory"} test` : "task"}
                                </span>
                              </div>
                              <div className="ml-6 flex flex-wrap items-center gap-1.5">
                                <label className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-2xs text-muted">
                                  <CalendarDays className="size-3" />
                                  <input type="date" value={it.date ?? ""} disabled={!!m.committed} onChange={(e) => updateItem(m.id, idx, { date: e.target.value || null })} aria-label="Date" className="bg-transparent text-2xs outline-none [color-scheme:dark]" />
                                </label>
                                <input type="time" value={it.time ?? ""} disabled={!!m.committed || !it.date} onChange={(e) => updateItem(m.id, idx, { time: e.target.value || null })} aria-label="Time" className="rounded border border-border bg-transparent px-1.5 py-0.5 text-2xs text-muted outline-none [color-scheme:dark] disabled:opacity-40" />
                                {it.kind === "task" && (
                                  <select value={it.category} disabled={!!m.committed} onChange={(e) => updateItem(m.id, idx, { category: e.target.value })} aria-label="Category" className="rounded border border-border bg-surface px-1 py-0.5 text-2xs" style={{ color: cat.color }}>
                                    {app.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                                  </select>
                                )}
                                <select value={it.priority} disabled={!!m.committed} onChange={(e) => updateItem(m.id, idx, { priority: e.target.value as Item["priority"] })} aria-label="Priority" className="rounded border border-border bg-surface px-1 py-0.5 text-2xs text-muted">
                                  {Object.entries(PRIO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                                {it.link_label && <span className="inline-flex items-center gap-1 text-2xs text-subtle"><Link2 className="size-3" />{it.link_label}</span>}
                                {!m.committed && (
                                  <button onClick={() => updateItem(m.id, idx, { keep: false })} className="ml-auto rounded p-0.5 text-subtle hover:text-danger" aria-label={`Remove ${it.title}`}><Trash2 className="size-3.5" /></button>
                                )}
                              </div>
                              {it.date && <p className="ml-6 text-2xs text-subtle">{relativeDay(it.date, app.today)}{it.time ? ` · ${fmt.time(it.time)}` : ""}</p>}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                        <span className="text-2xs text-subtle">{m.model ? `via ${m.model}` : m.fallback ? "AI unavailable — review dates" : ""}</span>
                        {m.committed ? (
                          <span className="inline-flex items-center gap-1 text-[13px] text-ok"><Check className="size-4" />{m.committed} · <Link href="/tasks?view=upcoming" className="underline" onClick={() => setOpen(false)}>View</Link></span>
                        ) : (
                          <button onClick={() => commit(m.id)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg hover:bg-accent/90">
                            <Check className="size-4" />Add {m.items.filter((i) => i.keep).length} to Diva
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div className="mr-10 inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[13px] text-muted" aria-live="polite">
                <Loader2 className="size-4 animate-spin" />Organising{elapsed > 8 ? ` — the AI is busy, still trying (${elapsed}s)` : "…"}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-border p-2.5"
          >
            <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 focus-within:border-border-strong">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={Math.min(5, Math.max(1, text.split("\n").length))}
                placeholder="e.g. CN quiz next tuesday, submit lab file by thursday…"
                aria-label="Message Diva"
                className="max-h-32 flex-1 resize-none bg-transparent text-[13.5px] outline-none placeholder:text-subtle"
              />
              <button type="submit" disabled={!text.trim() || thinking} aria-label="Send" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-40">
                <ArrowUp className="size-4" />
              </button>
            </div>
            <p className="mt-1 px-1 text-[10px] text-subtle">Enter to send · Shift+Enter for a new line · Ctrl+J to toggle</p>
          </form>
        </section>
      )}
    </>
  );
}
