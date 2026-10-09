"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Save } from "lucide-react";
import type { Hackathon } from "@/lib/types";
import { saveBrainDumpAction, saveHackathonDetailsAction, saveHackathonOutcomeAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, formObject } from "@/components/ui/form";

export function BrainDump({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const last = useRef(initial);
  const save = async (value: string) => {
    if (value === last.current) return setState("saved");
    setState("saving");
    const r = await saveBrainDumpAction(id, value);
    if (r.ok) {
      last.current = value;
      setState("saved");
    } else {
      setState("error");
      toast.error(`Couldn't save brain dump: ${r.error}`);
    }
  };
  useEffect(() => {
    if (text === last.current) return;
    setState("dirty");
    const t = setTimeout(() => save(text), 1200);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (text !== last.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [text]);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-2xs text-subtle">Ideas, problem statements, research, decisions, links — autosaves as you type.</p>
        <span className="flex items-center gap-1 text-2xs text-subtle" aria-live="polite">
          {state === "saving" && <><Loader2 className="size-3 animate-spin" />Saving…</>}
          {state === "saved" && <><Check className="size-3 text-ok" />Saved</>}
          {state === "dirty" && "Unsaved changes"}
          {state === "error" && <button className="text-danger underline" onClick={() => save(text)}>Retry save</button>}
        </span>
      </div>
      <textarea
        aria-label="Brain dump"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            save(text);
          }
        }}
        placeholder={"## Problem statement\n\n## Ideas\n- \n\n## Tech decisions\n\n## Links\n"}
        className="block min-h-[420px] w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-fg outline-none placeholder:text-subtle"
      />
    </div>
  );
}

function useSaver(fn: (d: Record<string, string>) => Promise<{ ok: boolean; error?: string }>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    start(async () => {
      const r = await fn(d);
      if (!r.ok) return setError(r.error ?? "Failed");
      setError(null);
      toast.success("Saved");
    });
  };
  return { pending, error, onSubmit };
}

export function DevSubmissionForm({ h }: { h: Hackathon }) {
  const { pending, error, onSubmit } = useSaver((d) => saveHackathonDetailsAction(h.id, d));
  return (
    <form onSubmit={onSubmit} className="card grid gap-3 p-4 sm:grid-cols-2" noValidate>
      <Field label="GitHub repository" htmlFor="d-repo"><Input id="d-repo" name="repo_url" type="url" defaultValue={h.repo_url ?? ""} placeholder="https://github.com/…" /></Field>
      <Field label="Live demo" htmlFor="d-demo"><Input id="d-demo" name="demo_url" type="url" defaultValue={h.demo_url ?? ""} placeholder="https://" /></Field>
      <Field label="Presentation" htmlFor="d-pres"><Input id="d-pres" name="presentation_url" type="url" defaultValue={h.presentation_url ?? ""} placeholder="https://" /></Field>
      <Field label="Submission" htmlFor="d-sub"><Input id="d-sub" name="submission_url" type="url" defaultValue={h.submission_url ?? ""} placeholder="Devpost / form link" /></Field>
      <Field label="Canva design" htmlFor="d-canva" className="sm:col-span-2"><Input id="d-canva" name="canva_url" type="url" defaultValue={h.canva_url ?? ""} placeholder="https://www.canva.com/design/…" /></Field>
      <Field label="Project description" htmlFor="d-pdesc" className="sm:col-span-2"><Textarea id="d-pdesc" name="project_description" defaultValue={h.project_description ?? ""} /></Field>
      <Field label="Team name" htmlFor="d-team"><Input id="d-team" name="team_name" defaultValue={h.team_name ?? ""} /></Field>
      <Field label="Team members & roles" htmlFor="d-members"><Input id="d-members" name="team_members" defaultValue={h.team_members ?? ""} /></Field>
      <Field label="Important milestones" htmlFor="d-ms" className="sm:col-span-2" hint="e.g. Idea lock Fri 6pm · MVP Sat noon · Video Sun 10am">
        <Textarea id="d-ms" name="milestones" defaultValue={h.milestones ?? ""} className="min-h-[70px]" />
      </Field>
      {error && <p className="text-sm text-danger sm:col-span-2" role="alert">{error}</p>}
      <div className="flex justify-end sm:col-span-2"><Button type="submit" variant="primary" loading={pending}><Save />Save details</Button></div>
    </form>
  );
}

export function OutcomeForm({ h }: { h: Hackathon }) {
  const { pending, error, onSubmit } = useSaver((d) => saveHackathonOutcomeAction(h.id, d));
  return (
    <form onSubmit={onSubmit} className="card grid gap-3 p-4 sm:grid-cols-2" noValidate>
      <Field label="Result / award" htmlFor="o-res"><Input id="o-res" name="results" defaultValue={h.results ?? ""} placeholder="e.g. Top 10 of 80 teams" /></Field>
      <Field label="Certificate link" htmlFor="o-cert"><Input id="o-cert" name="certificate_url" type="url" defaultValue={h.certificate_url ?? ""} placeholder="https://" /></Field>
      <Field label="Final demo" htmlFor="o-demo" className="sm:col-span-2"><Input id="o-demo" name="final_demo_url" type="url" defaultValue={h.final_demo_url ?? ""} placeholder="Video or live link" /></Field>
      <Field label="Achievements" htmlFor="o-ach" className="sm:col-span-2"><Textarea id="o-ach" name="achievements" defaultValue={h.achievements ?? ""} className="min-h-[70px]" /></Field>
      <Field label="Retrospective — what you learned" htmlFor="o-retro" className="sm:col-span-2"><Textarea id="o-retro" name="retrospective" defaultValue={h.retrospective ?? ""} /></Field>
      {error && <p className="text-sm text-danger sm:col-span-2" role="alert">{error}</p>}
      <div className="flex justify-end sm:col-span-2"><Button type="submit" variant="primary" loading={pending}><Save />Save outcomes</Button></div>
    </form>
  );
}
