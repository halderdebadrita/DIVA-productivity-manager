"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import type { Project } from "@/lib/types";
import { PROJECT_STATUSES } from "@/lib/constants";
import { saveProjectAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, formObject } from "@/components/ui/form";

export function ProjectFormDialog({ project }: { project?: Project }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(project?.progress_mode ?? "manual");
  const [pending, start] = useTransition();
  const router = useRouter();
  const p = project;
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    if (d.start_date && d.deadline && d.deadline < d.start_date) return setError("Deadline can't be before the start date");
    if (mode !== "manual") d.progress = String(p?.progress ?? 0);
    start(async () => {
      const r = await saveProjectAction(p?.id ?? null, d);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      toast.success(p ? "Project updated" : "Project created");
      if (!p) router.push(`/projects/${r.data.id}`);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      {p ? <Button size="sm" onClick={() => setOpen(true)}><Pencil />Edit</Button> : <Button variant="primary" onClick={() => setOpen(true)}><Plus />Add project</Button>}
      <DialogContent title={p ? "Edit project" : "Add project"} description="A GitHub repo is optional — add it whenever it exists." wide>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 p-5" noValidate>
          <Field label="Project name" htmlFor="p-name" required className="col-span-2"><Input id="p-name" name="name" defaultValue={p?.name} autoFocus /></Field>
          <Field label="Description" htmlFor="p-desc" className="col-span-2"><Textarea id="p-desc" name="description" defaultValue={p?.description ?? ""} className="min-h-[60px]" /></Field>
          <Field label="Problem statement / objective" htmlFor="p-obj" className="col-span-2"><Textarea id="p-obj" name="objective" defaultValue={p?.objective ?? ""} className="min-h-[60px]" /></Field>
          <Field label="Tech stack" htmlFor="p-stack" hint="Comma separated" className="col-span-2"><Input id="p-stack" name="tech_stack" defaultValue={p?.tech_stack.join(", ") ?? ""} placeholder="Next.js, Supabase, Tailwind" /></Field>
          <Field label="Status" htmlFor="p-status">
            <Select id="p-status" name="status" defaultValue={p?.status ?? "planning"}>{PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          </Field>
          <Field label="Progress tracking" htmlFor="p-mode">
            <Select id="p-mode" name="progress_mode" value={mode} onChange={(e) => setMode(e.target.value as Project["progress_mode"])}>
              <option value="manual">Manual percentage</option>
              <option value="milestones">From completed milestones</option>
              <option value="github">From GitHub (AI analysis)</option>
            </Select>
          </Field>
          {mode === "github" && <p className="col-span-2 -mt-1 text-2xs text-subtle">Needs a GitHub repository URL below. Diva re-estimates progress whenever you push new commits.</p>}
          {mode === "manual" && (
            <Field label="Progress %" htmlFor="p-prog" className="col-span-2"><Input id="p-prog" name="progress" type="number" min={0} max={100} defaultValue={p?.progress ?? 0} /></Field>
          )}
          <Field label="Start date" htmlFor="p-start"><Input id="p-start" name="start_date" type="date" defaultValue={p?.start_date ?? ""} /></Field>
          <Field label="Deadline" htmlFor="p-dl"><Input id="p-dl" name="deadline" type="date" defaultValue={p?.deadline ?? ""} /></Field>
          <Field label="GitHub repository" htmlFor="p-repo"><Input id="p-repo" name="repo_url" type="url" defaultValue={p?.repo_url ?? ""} placeholder="https://github.com/user/repo" /></Field>
          <Field label="Live demo" htmlFor="p-demo"><Input id="p-demo" name="demo_url" type="url" defaultValue={p?.demo_url ?? ""} placeholder="https://" /></Field>
          <Field label="Presentation" htmlFor="p-pres"><Input id="p-pres" name="presentation_url" type="url" defaultValue={p?.presentation_url ?? ""} placeholder="https://" /></Field>
          <Field label="Documentation" htmlFor="p-docs"><Input id="p-docs" name="docs_url" type="url" defaultValue={p?.docs_url ?? ""} placeholder="https://" /></Field>
          <input type="hidden" name="video_url" value={p?.video_url ?? ""} />
          {error && <p className="col-span-2 text-sm text-danger" role="alert">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>{p ? "Save" : "Create project"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
