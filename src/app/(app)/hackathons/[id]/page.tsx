import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Award, Brain, CalendarRange, Code2, Presentation, Trophy } from "lucide-react";
import { getCtx } from "@/lib/context";
import { fmt, todayIn } from "@/lib/dates";
import { HACKATHON_RESOURCE_KINDS } from "@/lib/constants";
import { getHackathon } from "@/lib/services/hackathons";
import { listResources } from "@/lib/services/resources";
import { listTasks } from "@/lib/services/tasks";
import { Badge, EmptyState } from "@/components/ui/bits";
import { ExternalButton } from "@/components/ui/link-button";
import { TabPanel, UrlTabs } from "@/components/ui/tabs";
import { AddResourceDialog, ResourceList } from "@/components/resources/resource-manager";
import { HackathonFormDialog } from "@/components/hackathons/hackathon-form";
import { StatusStepper } from "@/components/hackathons/status-stepper";
import { BrainDump, DevSubmissionForm, OutcomeForm } from "@/components/hackathons/workspace";
import { DeleteHackathon } from "@/components/hackathons/delete-hackathon";
import { TaskList } from "@/components/tasks/task-list";

export default async function HackathonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  const h = await getHackathon(ctx, id);
  if (!h) notFound();
  const [resources, tasks] = await Promise.all([listResources(ctx, { type: "hackathon", id }), listTasks(ctx)]);
  const linked = tasks.filter((t) => t.hackathon_id === id);
  const today = todayIn(ctx.tz);
  const presentation = resources.filter((r) => r.section !== "certificates");
  const certificates = resources.filter((r) => r.section === "certificates");
  const dates = [
    { label: "Registration closes", v: h.registration_deadline },
    { label: "Event", v: h.start_date ? `${fmt.day(h.start_date)}${h.end_date && h.end_date !== h.start_date ? ` – ${fmt.day(h.end_date)}` : ""}` : null, raw: true },
    { label: "Submission due", v: h.submission_deadline ? `${fmt.day(h.submission_deadline)}${h.submission_time ? `, ${fmt.time(h.submission_time)}` : ""}` : null, raw: true },
    { label: "Completed", v: h.completed_at ? fmt.instant(h.completed_at, ctx.tz) : null, raw: true },
  ];

  return (
    <div>
      <Link href="/hackathons" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><ArrowLeft className="size-3.5" />Hackathons</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{h.name}</h1>
          {h.description && <p className="mt-1 max-w-2xl text-sm text-muted">{h.description}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {h.canva_url && <ExternalButton href={h.canva_url} variant="primary">Open in Canva</ExternalButton>}
          <HackathonFormDialog hackathon={h} />
          <DeleteHackathon id={h.id} name={h.name} />
        </div>
      </div>
      <div className="mb-6"><StatusStepper id={h.id} status={h.status} /></div>

      <div className="grid grid-cols-1 gap-5 [&>*]:min-w-0 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Suspense>
            <UrlTabs
              defaultValue="brain"
              tabs={[
                { value: "brain", label: "Brain dump", icon: <Brain /> },
                { value: "resources", label: "Presentation & resources", icon: <Presentation /> },
                { value: "dev", label: "Development & submission", icon: <Code2 /> },
                { value: "outcomes", label: "Certificates & outcomes", icon: <Award /> },
              ]}
            >
              <TabPanel value="brain"><BrainDump id={h.id} initial={h.brain_dump ?? ""} /></TabPanel>
              <TabPanel value="resources">
                <div className="card p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-2xs text-subtle">Slides, Canva links, problem statements, research, submission docs, screenshots.</p>
                    <div className="flex gap-1.5">
                      {h.canva_url && <ExternalButton href={h.canva_url}>Open in Canva</ExternalButton>}
                      <AddResourceDialog entityType="hackathon" entityId={h.id} kinds={HACKATHON_RESOURCE_KINDS} section="resources" />
                    </div>
                  </div>
                  {presentation.length ? <ResourceList resources={presentation} kinds={HACKATHON_RESOURCE_KINDS} /> : <EmptyState title="No resources yet" className="mt-2">Upload files to private storage or save links hosted elsewhere.</EmptyState>}
                  {presentation.some((r) => r.kind === "canva") && !h.canva_url && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {presentation.filter((r) => r.kind === "canva" && r.url).map((r) => <ExternalButton key={r.id} href={r.url!} variant="primary">Open in Canva · {r.title}</ExternalButton>)}
                    </div>
                  )}
                </div>
              </TabPanel>
              <TabPanel value="dev">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {h.repo_url && <ExternalButton href={h.repo_url}>Repository</ExternalButton>}
                  {h.demo_url && <ExternalButton href={h.demo_url}>Live demo</ExternalButton>}
                  {h.presentation_url && <ExternalButton href={h.presentation_url}>Presentation</ExternalButton>}
                  {h.submission_url && <ExternalButton href={h.submission_url}>Submission</ExternalButton>}
                </div>
                <DevSubmissionForm h={h} />
              </TabPanel>
              <TabPanel value="outcomes" className="space-y-4">
                <div className="card p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="section-title">Certificates</h3>
                    <div className="flex gap-1.5">
                      {h.certificate_url && <ExternalButton href={h.certificate_url}>Certificate link</ExternalButton>}
                      <AddResourceDialog entityType="hackathon" entityId={h.id} kinds={HACKATHON_RESOURCE_KINDS} section="certificates" defaultKind="certificate" label="Upload certificate" />
                    </div>
                  </div>
                  {certificates.length ? <ResourceList resources={certificates} kinds={HACKATHON_RESOURCE_KINDS} /> : <p className="py-2 text-sm text-muted">{h.status === "completed" ? "Upload your certificate here, then tick off the LinkedIn follow-up task." : "Available any time — most useful after the event."}</p>}
                </div>
                <OutcomeForm h={h} />
              </TabPanel>
            </UrlTabs>
          </Suspense>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 flex items-center gap-2 section-title"><CalendarRange className="size-4 text-subtle" />Key dates</h2>
            <dl className="space-y-1.5 text-[13px]">
              {dates.map((d) => (
                <div key={d.label} className="flex justify-between gap-3">
                  <dt className="text-muted">{d.label}</dt>
                  <dd className="num text-right">{d.v ? (d.raw ? d.v : fmt.day(d.v)) : <span className="text-subtle">—</span>}</dd>
                </div>
              ))}
            </dl>
            {h.status === "completed" && <Badge tone="ok" className="mt-3"><Trophy aria-hidden />Completed · stays in your archive</Badge>}
          </section>
          <section className="card p-4">
            <h2 className="mb-1 section-title">Tasks</h2>
            <TaskList tasks={linked} today={today} emptyText="No linked tasks yet." addDraft={{ hackathon_id: h.id, slug: "hackathons" }} />
          </section>
        </aside>
      </div>
    </div>
  );
}
