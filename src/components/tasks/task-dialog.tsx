"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, ExternalLink, Sparkles, Trash2, Trophy } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, formObject } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Badge, Spinner } from "@/components/ui/bits";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { fmt } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { deleteTaskAction, fetchTaskAction, saveTaskAction } from "@/app/actions/tasks";
import { useApp } from "@/components/shell/app-provider";

export function TaskDialog() {
  const app = useApp();
  const { dialog, closeTask } = app;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Load the task when opened by id (deep links, search, reminders)
  useEffect(() => {
    setError(null);
    if (!dialog.open) return;
    if (dialog.task) return setTask(dialog.task);
    if (dialog.taskId) {
      setLoading(true);
      setTask(null);
      fetchTaskAction(dialog.taskId).then((r) => {
        setLoading(false);
        if (r.ok && r.data) setTask(r.data);
        else {
          toast.error("That task no longer exists");
          closeTask();
        }
      });
    } else setTask(null);
  }, [dialog, closeTask]);

  const isNew = !dialog.taskId;
  const draft = dialog.draft ?? {};
  const v = (k: keyof Task) => (task ? (task[k] as string | null) ?? "" : ((draft as Record<string, unknown>)[k] as string) ?? "");
  const [projectId, setProjectId] = useState("");
  useEffect(() => setProjectId(v("project_id")), [task, dialog]); // eslint-disable-line react-hooks/exhaustive-deps
  const milestones = useMemo(() => app.milestones.filter((m) => m.project_id === projectId), [app.milestones, projectId]);

  function onOpenChange(open: boolean) {
    if (open) return;
    closeTask();
    if (params.get("task")) {
      const next = new URLSearchParams(params);
      next.delete("task");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    start(async () => {
      const r = await saveTaskAction(isNew ? null : dialog.taskId, data);
      if (!r.ok) return setError(r.error);
      toast.success(isNew ? "Task added" : "Task saved");
      onOpenChange(false);
    });
  }

  const defaultCategory = v("category_id") || app.catBySlug("other").id;
  const key = `${dialog.taskId ?? "new"}-${task?.updated_at ?? ""}-${JSON.stringify(draft)}`;

  return (
    <Dialog open={dialog.open} onOpenChange={onOpenChange}>
      <DialogContent side title={isNew ? "New task" : "Task details"} description={isNew ? "Capture it now, organise later." : task ? `Created ${fmt.instant(task.created_at, app.tz)}` : undefined}>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Spinner /></div>
        ) : (
          <form key={key} ref={formRef} onSubmit={submit} className="flex h-full flex-col" noValidate>
            <div className="flex-1 space-y-4 px-5 py-4">
              {task?.source === "hackathon_followup" && (
                <Badge tone="accent"><Trophy aria-hidden />Auto-created hackathon follow-up</Badge>
              )}
              {task?.source === "side_quest" && <Badge tone="accent"><Sparkles aria-hidden />From a side quest</Badge>}
              <Field label="Title" htmlFor="t-title" required>
                <Input id="t-title" name="title" defaultValue={v("title")} autoFocus={isNew} required maxLength={200} placeholder="e.g. Submit DBMS assignment" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category" htmlFor="t-cat" required>
                  <Select id="t-cat" name="category_id" defaultValue={defaultCategory}>
                    {app.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Priority" htmlFor="t-prio">
                  <Select id="t-prio" name="priority" defaultValue={v("priority") || "medium"}>
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </Field>
                <Field label="Due date" htmlFor="t-date" hint="Optional — undated tasks live in the Inbox">
                  <Input id="t-date" name="due_date" type="date" defaultValue={v("due_date")} />
                </Field>
                <Field label="Due time" htmlFor="t-time">
                  <Input id="t-time" name="due_time" type="time" defaultValue={v("due_time")} />
                </Field>
                <Field label="Status" htmlFor="t-status">
                  <Select id="t-status" name="status" defaultValue={v("status") || "not_started"}>
                    {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Field>
                <Field label="Estimate (minutes)" htmlFor="t-est">
                  <Input id="t-est" name="estimated_minutes" type="number" min={1} inputMode="numeric" defaultValue={task?.estimated_minutes ?? ""} placeholder="60" />
                </Field>
              </div>
              <Field label="Description" htmlFor="t-desc">
                <Textarea id="t-desc" name="description" defaultValue={v("description")} placeholder="Details, acceptance criteria, notes…" />
              </Field>

              <fieldset className="space-y-3 rounded-md border border-border p-3">
                <legend className="px-1 text-2xs font-medium uppercase tracking-wider text-subtle">Linked to</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Project" htmlFor="t-proj">
                    <Select id="t-proj" name="project_id" defaultValue={v("project_id")} onChange={(e) => setProjectId(e.target.value)}>
                      <option value="">None</option>
                      {app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Milestone" htmlFor="t-ms">
                    <Select id="t-ms" name="milestone_id" defaultValue={v("milestone_id")} disabled={!milestones.length} key={projectId}>
                      <option value="">{projectId ? (milestones.length ? "None" : "No milestones") : "Pick a project"}</option>
                      {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </Select>
                  </Field>
                  <Field label="Test" htmlFor="t-test">
                    <Select id="t-test" name="test_id" defaultValue={v("test_id")}>
                      <option value="">None</option>
                      {app.tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Hackathon" htmlFor="t-hack">
                    <Select id="t-hack" name="hackathon_id" defaultValue={v("hackathon_id")}>
                      <option value="">None</option>
                      {app.hackathons.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </Select>
                  </Field>
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Link" htmlFor="t-link" className="col-span-2 sm:col-span-1">
                  <Input id="t-link" name="link_url" type="url" defaultValue={v("link_url")} placeholder="https://" />
                </Field>
                <Field label="Email reminder" htmlFor="t-email" className="col-span-2 sm:col-span-1" hint={app.integrations.email ? undefined : "Email provider not configured yet"}>
                  <Select id="t-email" name="email_reminder" defaultValue={v("email_reminder") || "default"}>
                    <option value="default">Use my reminder settings</option>
                    <option value="off">Don&apos;t email me</option>
                  </Select>
                </Field>
              </div>

              {task && (
                <div className="flex flex-wrap gap-2 text-2xs text-subtle">
                  {task.link_url && (
                    <a className="inline-flex items-center gap-1 text-accent hover:underline" href={task.link_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />Open link
                    </a>
                  )}
                  {task.hackathon_id && <Link className="text-accent hover:underline" href={`/hackathons/${task.hackathon_id}`} onClick={() => onOpenChange(false)}>Open hackathon</Link>}
                  {task.project_id && <Link className="text-accent hover:underline" href={`/projects/${task.project_id}`} onClick={() => onOpenChange(false)}>Open project</Link>}
                  {task.completed_at && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" />Completed {fmt.instant(task.completed_at, app.tz)}</span>}
                </div>
              )}
              {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
            </div>
            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3">
              {!isNew && task ? (
                <Confirm
                  title="Delete this task?"
                  description="It will disappear from every view and its unsent reminders are cancelled. This can't be undone."
                  onConfirm={async () => {
                    const r = await deleteTaskAction(task.id);
                    if (!r.ok) return toast.error(r.error);
                    toast.success("Task deleted");
                    onOpenChange(false);
                  }}
                  trigger={<Button type="button" variant="ghost" className="text-danger hover:text-danger"><Trash2 />Delete</Button>}
                />
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={pending}>{isNew ? "Add task" : "Save"}</Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Opens the task dialog for ?task=<id> deep links (reminders, emails, search, calendar). */
export function TaskDeepLink() {
  const params = useSearchParams();
  const { openTask, dialog } = useApp();
  const id = params.get("task");
  useEffect(() => {
    if (id && !(dialog.open && dialog.taskId === id)) openTask(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
