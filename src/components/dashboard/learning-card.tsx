"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, Bookmark, BookmarkCheck, BookOpen, CheckCheck, ExternalLink, History, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/dates";
import type { LearningState } from "@/lib/services/learning";
import { generateLearningAction, markTopicAction } from "@/app/actions/misc";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/bits";
import { useApp } from "@/components/shell/app-provider";

export function LearningCard({ initial }: { initial: LearningState | null }) {
  const app = useApp();
  const [state, setState] = useState<LearningState | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [showMore, setShowMore] = useState(false);
  const [, start] = useTransition();
  const started = useRef(false);

  const generate = async () => {
    setLoading(true);
    const r = await generateLearningAction();
    setLoading(false);
    if (r.ok) setState(r.data);
    else toast.error(r.error);
  };

  // Only fetches when today's topic doesn't exist yet; the server stores it so refreshes reuse it.
  useEffect(() => {
    if (!initial && !started.current) {
      started.current = true;
      generate();
    }
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initial) setState(initial);
  }, [initial]);

  const topic = state?.topic;
  const stored = topic && "user_id" in topic ? topic : null;
  const flag = (patch: { is_read?: boolean; is_saved?: boolean }) => {
    if (!stored) return;
    setState((s) => (s ? ({ ...s, topic: { ...s.topic, ...patch } } as LearningState) : s));
    start(async () => {
      const r = await markTopicAction(stored.id, patch);
      if (!r.ok) toast.error(r.error);
    });
  };
  const resources = topic ? [...(topic.source_url ? [{ title: "Source", url: topic.source_url }] : []), ...(topic.further_reading ?? [])] : [];

  return (
    <section className="card relative flex min-w-0 flex-col overflow-hidden" aria-labelledby="dkl-title">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <header className="relative flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 id="dkl-title" className="flex items-center gap-2 section-title">
          <Sparkles className="size-4 text-accent" />Diva Keeps Learning
        </h2>
        <div className="flex items-center gap-1">
          <span className="rounded border border-border px-1.5 py-0.5 num text-2xs text-subtle" title="Topic date">{fmt.day(topic?.generated_for ?? app.today)}</span>
          <Link href="/learning" className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Learning history" title="Learning history"><History className="size-4" /></Link>
        </div>
      </header>
      <div className="relative flex-1 p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Generating today's topic">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" />
            <p className="pt-1 text-2xs text-subtle">Writing today&apos;s topic…</p>
          </div>
        ) : topic ? (
          <>
            {state && state.status !== "ok" && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-warn/20 bg-warn/[0.06] px-3 py-2 text-2xs text-warn">
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                <div className="flex-1">
                  {state.status === "not_configured" && "AI isn't configured yet (add GEMINI_API_KEY or ANTHROPIC_API_KEY). Showing an offline topic, not a generated one."}
                  {state.status === "stale" && `Couldn't generate today's topic — showing your most recent one. ${state.error ?? ""}`}
                  {state.status === "fallback" && `Generation failed — showing an offline topic. ${state.error ?? ""}`}
                </div>
                {state.status !== "not_configured" && (
                  <button onClick={generate} className="inline-flex items-center gap-1 underline underline-offset-2"><RefreshCw className="size-3" />Retry</button>
                )}
              </div>
            )}
            <p className="eyebrow">{topic.category}</p>
            <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{topic.title}</h3>
            <div className={cn("prose-diva mt-3 text-[13.5px] text-fg/85", stored?.is_read && "text-fg/70")}>
              {topic.content.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-1 flex gap-2.5 rounded-md border-l-2 border-accent bg-accent/[0.06] px-3 py-2.5">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-[13px] font-medium leading-relaxed">{topic.key_takeaway}</p>
            </div>
            {showMore && resources.length > 0 && (
              <ul className="mt-3 space-y-1">
                {resources.map((r) => (
                  <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"><ExternalLink className="size-3.5" />{r.title}</a></li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">No topic available.</p>
        )}
      </div>
      {!loading && topic && (
        <footer className="relative flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2.5 sm:px-5">
          <Button size="sm" variant={stored?.is_saved ? "primary" : "secondary"} disabled={!stored} onClick={() => flag({ is_saved: !stored?.is_saved })} aria-pressed={!!stored?.is_saved}>
            {stored?.is_saved ? <BookmarkCheck /> : <Bookmark />}{stored?.is_saved ? "Saved" : "Save"}
          </Button>
          <Button size="sm" variant={stored?.is_read ? "primary" : "secondary"} disabled={!stored} onClick={() => flag({ is_read: !stored?.is_read })} aria-pressed={!!stored?.is_read}>
            <CheckCheck />{stored?.is_read ? "Read" : "Mark as read"}
          </Button>
          <Button size="sm" variant="ghost" disabled={!resources.length} onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
            <BookOpen />{resources.length ? (showMore ? "Hide resources" : `Resources (${resources.length})`) : "No resources"}
          </Button>
          {stored?.model && <Badge className="ml-auto" title="Generated by">{stored.model}</Badge>}
        </footer>
      )}
    </section>
  );
}
