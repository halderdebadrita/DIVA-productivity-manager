"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Image as ImageIcon, Link2, Paperclip, Plus, Search, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/dates";
import type { Resource, ResourceEntity } from "@/lib/types";
import { addLinkResourceAction, deleteResourceAction, uploadResourceAction } from "@/app/actions/misc";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/bits";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, formObject } from "@/components/ui/form";
import { Confirm } from "@/components/ui/confirm";
import { useApp } from "@/components/shell/app-provider";

export const resourceHref = (r: Resource) => (r.storage_path ? `/api/files/${r.id}` : r.url!);

function sizeLabel(n: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function ResourceList({ resources, kinds, compact }: { resources: Resource[]; kinds: { value: string; label: string }[]; compact?: boolean }) {
  const app = useApp();
  const [, start] = useTransition();
  if (!resources.length) return null;
  const kindLabel = (k: string) => kinds.find((x) => x.value === k)?.label ?? k;
  return (
    <ul className="divide-y divide-border/60">
      {resources.map((r) => {
        const Icon = r.storage_path ? (r.mime_type?.startsWith("image/") ? ImageIcon : FileText) : Link2;
        return (
          <li key={r.id} className="group flex items-center gap-3 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-3 text-subtle"><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <a href={resourceHref(r)} target="_blank" rel="noopener noreferrer" className="block truncate text-sm hover:underline">{r.title}</a>
              <div className="flex flex-wrap items-center gap-x-2 text-2xs text-subtle">
                <span>{kindLabel(r.kind)}</span>
                {r.subject && !compact && <span>· {r.subject}</span>}
                {r.storage_path ? <span>· {r.file_name} {sizeLabel(r.size_bytes)}</span> : <span className="truncate">· {r.url?.replace(/^https?:\/\//, "").slice(0, 40)}</span>}
                {!compact && <span>· added {fmt.instant(r.created_at, app.tz)}</span>}
              </div>
              {r.description && !compact && <p className="mt-0.5 truncate text-2xs text-muted">{r.description}</p>}
            </div>
            <a href={resourceHref(r)} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-subtle hover:bg-surface-3 hover:text-fg" aria-label={`Open ${r.title}`}><ExternalLink className="size-4" /></a>
            <Confirm
              title="Delete this resource?"
              description={r.storage_path ? "The uploaded file is permanently removed from storage." : "The saved link is removed."}
              onConfirm={() => start(async () => {
                const res = await deleteResourceAction(r.id);
                if (!res.ok) toast.error(res.error);
                else toast.success("Removed");
              })}
              trigger={<button className="rounded p-1.5 text-subtle hover:bg-surface-3 hover:text-danger" aria-label={`Delete ${r.title}`}><Trash2 className="size-4" /></button>}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function AddResourceDialog({
  entityType, entityId, kinds, section, defaultKind, subjects, label = "Add resource", tests, triggerVariant = "secondary",
}: {
  entityType: ResourceEntity; entityId?: string | null; kinds: { value: string; label: string }[]; section?: string; defaultKind?: string;
  subjects?: string[]; label?: string; tests?: { id: string; name: string }[]; triggerVariant?: "secondary" | "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "file">("link");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    start(async () => {
      let r;
      const linkedTest = (new FormData(form).get("test_id") as string) || "";
      const et = tests && linkedTest ? "test" : entityType;
      const eid = tests ? linkedTest || null : entityId ?? null;
      if (mode === "link") {
        const d = formObject(form);
        r = await addLinkResourceAction({ ...d, entity_type: et, entity_id: eid, section: section ?? null });
      } else {
        const fd = new FormData(form);
        const f = fd.get("file");
        if (!(f instanceof File) || !f.size) return setError("Choose a file to upload");
        if (f.size > 20 * 1024 * 1024) return setError("Files must be 20 MB or smaller");
        fd.set("entity_type", et);
        fd.set("entity_id", eid ?? "");
        if (section) fd.set("section", section);
        r = await uploadResourceAction(fd);
      }
      if (!r.ok) return setError(r.error);
      toast.success(mode === "link" ? "Link saved" : "File uploaded");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <Button size="sm" variant={triggerVariant} onClick={() => setOpen(true)}><Plus />{label}</Button>
      <DialogContent title={label} description="Save a link, or upload a file to private storage (max 20 MB).">
        <form onSubmit={submit} className="space-y-4 p-5" noValidate>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-2 p-1">
            {(["link", "file"] as const).map((m) => (
              <button type="button" role="tab" aria-selected={mode === m} key={m} onClick={() => setMode(m)} className={cn("flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[13px]", mode === m ? "bg-surface-3 text-fg" : "text-muted")}>
                {m === "link" ? <><Link2 className="size-3.5" />Link</> : <><Upload className="size-3.5" />Upload file</>}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" htmlFor="r-title" required={mode === "link"} className="col-span-2">
              <Input id="r-title" name="title" placeholder={mode === "file" ? "Defaults to file name" : "e.g. Unit 3 notes"} maxLength={200} />
            </Field>
            <Field label="Type" htmlFor="r-kind">
              <Select id="r-kind" name="kind" defaultValue={defaultKind ?? kinds[0]?.value}>
                {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
            </Field>
            {subjects ? (
              <Field label="Subject" htmlFor="r-subject">
                <Input id="r-subject" name="subject" list="r-subjects" placeholder="e.g. DBMS" maxLength={120} />
                <datalist id="r-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
            ) : <span />}
            {tests && (
              <Field label="For test (optional)" htmlFor="r-test" className="col-span-2">
                <Select id="r-test" name="test_id" defaultValue={entityId ?? ""}>
                  <option value="">General study material</option>
                  {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
            )}
            {mode === "link" ? (
              <Field label="URL" htmlFor="r-url" required className="col-span-2">
                <Input id="r-url" name="url" type="url" placeholder="https://" />
              </Field>
            ) : (
              <Field label="File" htmlFor="r-file" required className="col-span-2" hint="PDF, images, Office docs, text or zip · up to 20 MB">
                <Input ref={fileRef} id="r-file" name="file" type="file" className="file:mr-3 file:rounded file:border-0 file:bg-surface-3 file:px-2 file:py-1 file:text-xs file:text-fg" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.ppt,.pptx,.doc,.docx,.zip" />
              </Field>
            )}
            <Field label="Description" htmlFor="r-desc" className="col-span-2">
              <Textarea id="r-desc" name="description" className="min-h-[60px]" maxLength={2000} />
            </Field>
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>{mode === "link" ? "Save link" : "Upload"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResourceBrowser({ resources, kinds, tests }: { resources: Resource[]; kinds: { value: string; label: string }[]; tests: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [kind, setKind] = useState("all");
  const subjects = useMemo(() => Array.from(new Set(resources.map((r) => r.subject).filter(Boolean) as string[])).sort(), [resources]);
  const list = resources.filter(
    (r) => (subject === "all" || r.subject === subject) && (kind === "all" || r.kind === kind) && (!q.trim() || `${r.title} ${r.description ?? ""} ${r.subject ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials" aria-label="Search materials" className="h-8 py-1 pl-8 text-[13px]" />
        </div>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" className="h-8 w-auto py-1 text-[13px]">
          <option value="all">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type" className="h-8 w-auto py-1 text-[13px]">
          <option value="all">All types</option>
          {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </Select>
        <div className="ml-auto"><AddResourceDialog entityType="study" kinds={kinds} subjects={subjects} tests={tests} label="Add material" triggerVariant="primary" /></div>
      </div>
      {list.length ? (
        <div className="card px-4 py-1">
          {list.map((r) => {
            const t = tests.find((x) => x.id === r.entity_id);
            return (
              <div key={r.id}>
                <ResourceList resources={[r]} kinds={kinds} />
                {t && <div className="-mt-1.5 mb-1.5 ml-11"><Badge tone="outline">For {t.name}</Badge></div>}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Paperclip} title={resources.length ? "No materials match" : "No study materials yet"}>Save notes, PDFs, PYQs, slides and reference links — organised by subject.</EmptyState>
      )}
    </div>
  );
}
