"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import type { Test } from "@/lib/types";
import { PREP_STATUSES } from "@/lib/constants";
import { saveTestAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, formObject } from "@/components/ui/form";

export function TestFormDialog({ test, subjects }: { test?: Test; subjects: string[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    start(async () => {
      const r = await saveTestAction(test?.id ?? null, d);
      if (!r.ok) return setError(r.error);
      toast.success(test ? "Test updated" : "Test added — it's on your calendar");
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      {test ? (
        <Button size="icon" variant="ghost" aria-label={`Edit ${test.name}`} onClick={() => setOpen(true)}><Pencil /></Button>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}><Plus />Add test</Button>
      )}
      <DialogContent title={test ? "Edit test" : "Add test"} wide>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 p-5" noValidate>
          <Field label="Test name" htmlFor="x-name" required className="col-span-2 sm:col-span-1"><Input id="x-name" name="name" defaultValue={test?.name} placeholder="e.g. DBMS Mid-Sem" autoFocus /></Field>
          <Field label="Subject" htmlFor="x-subj" required className="col-span-2 sm:col-span-1">
            <Input id="x-subj" name="subject" defaultValue={test?.subject} list="x-subjects" />
            <datalist id="x-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Type" htmlFor="x-type" required>
            <Select id="x-type" name="type" defaultValue={test?.type ?? "theory"}><option value="theory">Theory</option><option value="practical">Practical</option></Select>
          </Field>
          <Field label="Preparation" htmlFor="x-prep">
            <Select id="x-prep" name="prep_status" defaultValue={test?.prep_status ?? "not_started"}>{PREP_STATUSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
          </Field>
          <Field label="Date" htmlFor="x-date" required><Input id="x-date" name="test_date" type="date" defaultValue={test?.test_date} /></Field>
          <Field label="Time" htmlFor="x-time"><Input id="x-time" name="test_time" type="time" defaultValue={test?.test_time ?? ""} /></Field>
          <Field label="Syllabus / topics" htmlFor="x-syl" className="col-span-2"><Textarea id="x-syl" name="syllabus" defaultValue={test?.syllabus ?? ""} placeholder="Units, chapters, experiments…" /></Field>
          <Field label="Notes" htmlFor="x-notes" className="col-span-2"><Textarea id="x-notes" name="notes" defaultValue={test?.notes ?? ""} className="min-h-[60px]" /></Field>
          {error && <p className="col-span-2 text-sm text-danger" role="alert">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>{test ? "Save" : "Add test"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
