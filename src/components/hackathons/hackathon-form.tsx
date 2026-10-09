"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import type { Hackathon } from "@/lib/types";
import { HACKATHON_STATUSES } from "@/lib/constants";
import { saveHackathonAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, formObject } from "@/components/ui/form";

export function HackathonFormDialog({ hackathon }: { hackathon?: Hackathon }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const h = hackathon;
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    if (d.start_date && d.end_date && d.end_date < d.start_date) return setError("End date can't be before the start date");
    start(async () => {
      const r = await saveHackathonAction(h?.id ?? null, d);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      if (r.data.followup?.created) toast.success("Marked complete", { description: `Certificate follow-up task created, due ${r.data.followup.task.due_date}` });
      else toast.success(h ? "Hackathon updated" : "Hackathon added");
      if (!h) router.push(`/hackathons/${r.data.hackathon.id}`);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      {h ? <Button size="sm" onClick={() => setOpen(true)}><Pencil />Edit</Button> : <Button variant="primary" onClick={() => setOpen(true)}><Plus />Add hackathon</Button>}
      <DialogContent title={h ? "Edit hackathon" : "Add hackathon"} description="Only the name is required — fill in the rest as you learn it." wide>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 p-5" noValidate>
          <Field label="Name" htmlFor="h-name" required className="col-span-2"><Input id="h-name" name="name" defaultValue={h?.name} autoFocus /></Field>
          <Field label="Short description" htmlFor="h-desc" className="col-span-2"><Textarea id="h-desc" name="description" defaultValue={h?.description ?? ""} className="min-h-[60px]" /></Field>
          <Field label="Event starts" htmlFor="h-start"><Input id="h-start" name="start_date" type="date" defaultValue={h?.start_date ?? ""} /></Field>
          <Field label="Event ends" htmlFor="h-end"><Input id="h-end" name="end_date" type="date" defaultValue={h?.end_date ?? ""} /></Field>
          <Field label="Registration deadline" htmlFor="h-reg"><Input id="h-reg" name="registration_deadline" type="date" defaultValue={h?.registration_deadline ?? ""} /></Field>
          <Field label="Status" htmlFor="h-status">
            <Select id="h-status" name="status" defaultValue={h?.status ?? "registered"}>{HACKATHON_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          </Field>
          <Field label="Submission deadline" htmlFor="h-sub"><Input id="h-sub" name="submission_deadline" type="date" defaultValue={h?.submission_deadline ?? ""} /></Field>
          <Field label="Submission time" htmlFor="h-subt"><Input id="h-subt" name="submission_time" type="time" defaultValue={h?.submission_time ?? ""} /></Field>
          <Field label="Team name" htmlFor="h-team"><Input id="h-team" name="team_name" defaultValue={h?.team_name ?? ""} /></Field>
          <Field label="Team members" htmlFor="h-members"><Input id="h-members" name="team_members" defaultValue={h?.team_members ?? ""} placeholder="Comma separated" /></Field>
          {error && <p className="col-span-2 text-sm text-danger" role="alert">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>{h ? "Save" : "Add hackathon"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
