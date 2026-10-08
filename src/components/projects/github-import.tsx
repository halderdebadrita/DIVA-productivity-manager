"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, GitBranch, Loader2, Lock, Search, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/dates";
import { analyzeProjectAction, autoRefreshAction, importReposAction, listMyReposAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { Badge, Spinner } from "@/components/ui/bits";
import { useApp } from "@/components/shell/app-provider";

type Repo = {
  full_name: string; name: string; description: string | null; html_url: string; language: string | null; pushed_at: string | null;
  fork: boolean; archived: boolean; private: boolean; stars: number; projectId: string | null;
};

export function GithubImport() {
  const app = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ login: string; includesPrivate: boolean; repos: Repo[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [showForks, setShowForks] = useState(false);
  const [phase, setPhase] = useState<"pick" | "working" | "done">("pick");
  const [progress, setProgress] = useState<{ name: string; state: "waiting" | "analysing" | "done" | "error"; note?: string }[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const r = await listMyReposAction();
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setData(r.data);
    // preselect active, non-fork repos you haven't imported
    const sixMonths = Date.now() - 180 * 864e5;
    setSelected(new Set(r.data.repos.filter((x) => !x.projectId && !x.fork && x.pushed_at && new Date(x.pushed_at).getTime() > sixMonths).map((x) => x.full_name)));
  };
  useEffect(() => {
    if (open && !data && !loading) load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(
    () => (data?.repos ?? []).filter((r) => (showForks || !r.fork) && (!q.trim() || `${r.name} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))),
    [data, q, showForks],
  );

  const run = async () => {
    const names = [...selected];
    if (!names.length) return;
    setPhase("working");
    const r = await importReposAction(names);
    if (!r.ok) {
      setPhase("pick");
      return void toast.error(r.error);
    }
    const created = r.data;
    setProgress(created.map((c) => ({ name: c.name, state: "waiting" })));
    if (!app.integrations.ai) {
      setPhase("done");
      router.refresh();
      return;
    }
    // analyse one by one so the AI isn't flooded
    for (let i = 0; i < created.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 6000)); // stay under free-tier per-minute limits
      setProgress((p) => p.map((x, j) => (j === i ? { ...x, state: "analysing" } : x)));
      const a = await analyzeProjectAction(created[i].id);
      setProgress((p) => p.map((x, j) => (j === i ? { ...x, state: a.ok ? "done" : "error", note: a.ok ? `${a.data.analysis.progress}% · ${a.data.analysis.status.replace("_", " ")}` : a.error } : x)));
    }
    setPhase("done");
    router.refresh();
  };

  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setPhase("pick");
      setProgress([]);
      setData(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <Button onClick={() => setOpen(true)}><GitBranch />Import from GitHub</Button>
      <DialogContent title="Import projects from GitHub" description={data ? `Repositories of @${data.login}${data.includesPrivate ? " (incl. private)" : " — public only"}` : "Pick the repositories to track in Diva."} wide>
        {phase === "pick" && (
          <div className="flex max-h-[70dvh] flex-col">
            {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted"><Spinner />Loading your repositories…</div>}
            {error && (
              <div className="m-5 rounded-md border border-danger/30 bg-danger/[0.07] p-3 text-sm text-danger">
                <p className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>
                {/Quick links/.test(error) && <Link href="/settings#quick-links" className="mt-2 inline-block underline" onClick={() => reset(false)}>Open Settings → Quick links</Link>}
                <button onClick={load} className="ml-3 underline">Retry</button>
              </div>
            )}
            {data && (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                  <div className="relative min-w-[160px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter repositories" className="h-8 py-1 pl-8 text-[13px]" />
                  </div>
                  <label className="flex items-center gap-1.5 text-2xs text-muted"><input type="checkbox" checked={showForks} onChange={(e) => setShowForks(e.target.checked)} className="accent-[rgb(214,255,112)]" />Show forks</label>
                  <button className="text-2xs text-accent hover:underline" onClick={() => setSelected(new Set(list.filter((r) => !r.projectId).map((r) => r.full_name)))}>Select all</button>
                  <button className="text-2xs text-subtle hover:underline" onClick={() => setSelected(new Set())}>None</button>
                </div>
                <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-2">
                  {list.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No repositories found.</li>}
                  {list.map((r) => {
                    const on = selected.has(r.full_name);
                    return (
                      <li key={r.full_name}>
                        <label className={cn("flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 hover:bg-surface-2", r.projectId && "cursor-default opacity-60")}>
                          <input
                            type="checkbox"
                            className="mt-1 accent-[rgb(214,255,112)]"
                            disabled={!!r.projectId}
                            checked={on || !!r.projectId}
                            onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.full_name); else n.delete(r.full_name); return n; })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{r.name}</span>
                              {r.private && <Badge><Lock aria-hidden />Private</Badge>}
                              {r.fork && <Badge>Fork</Badge>}
                              {r.archived && <Badge>Archived</Badge>}
                              {r.projectId && <Badge tone="ok"><Check aria-hidden />In Diva</Badge>}
                            </div>
                            {r.description && <p className="mt-0.5 line-clamp-1 text-2xs text-muted">{r.description}</p>}
                            <p className="mt-0.5 text-2xs text-subtle">
                              {r.language ?? "—"}{r.stars ? <> · <Star className="inline size-3" /> {r.stars}</> : null}{r.pushed_at ? ` · pushed ${fmt.instant(r.pushed_at, app.tz)}` : ""}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                  <p className="text-2xs text-subtle">
                    {app.integrations.ai ? "Each imported repo is analysed by AI: description, progress, done & remaining." : "AI isn't configured — repos are imported without analysis."}
                  </p>
                  <Button variant="primary" disabled={!selected.size} onClick={run}><Sparkles />Import {selected.size || ""}</Button>
                </div>
              </>
            )}
          </div>
        )}
        {phase !== "pick" && (
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted">{phase === "working" ? "Importing and analysing — this can take ~20–60s per repo while the AI reads the code…" : "Done. Progress keeps updating automatically when you push new commits."}</p>
            <ul className="space-y-1.5">
              {progress.length === 0 && <li className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Creating projects…</li>}
              {progress.map((p) => (
                <li key={p.name} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  {p.state === "analysing" ? <Loader2 className="size-4 animate-spin text-accent" /> : p.state === "done" ? <Check className="size-4 text-ok" /> : p.state === "error" ? <AlertCircle className="size-4 text-danger" /> : <span className="size-4 rounded-full border border-border-strong" />}
                  <span className="flex-1">{p.name}</span>
                  <span className={cn("text-2xs", p.state === "error" ? "text-danger" : "text-subtle")}>{p.state === "analysing" ? "reading the repo…" : p.note ?? ""}</span>
                </li>
              ))}
            </ul>
            {phase === "done" && <div className="flex justify-end"><Button variant="primary" onClick={() => reset(false)}>Close</Button></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Quietly keeps GitHub projects fresh when you open the page (at most every 30 min per tab session). */
export function GithubAutoRefresh({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const key = `diva.gh.refresh.${projectId ?? "all"}`;
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30 * 60e3) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {}
    autoRefreshAction(projectId).then((r) => {
      if (r.ok && (r.data.synced || r.data.analysed)) {
        if (r.data.analysed) toast.success(`Updated ${r.data.analysed} project${r.data.analysed > 1 ? "s" : ""} from GitHub`);
        router.refresh();
      }
    });
  }, [projectId, router]);
  return null;
}
