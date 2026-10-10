import { FolderOpen } from "lucide-react";
import { getCtx } from "@/lib/context";
import { listTests } from "@/lib/services/tests";
import { listResources } from "@/lib/services/resources";
import { listTasks } from "@/lib/services/tasks";
import { STUDY_RESOURCE_KINDS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/bits";
import { LinkButton } from "@/components/ui/link-button";
import { TestsView } from "@/components/tests/tests-view";
import { TestFormDialog } from "@/components/tests/test-form";
import { AIShortcuts } from "@/components/tests/ai-shortcuts";
import { StudyLinks } from "@/components/tests/study-links";
import { ResourceList } from "@/components/resources/resource-manager";

export const metadata = { title: "Tests" };

export default async function TestsPage() {
  const ctx = await getCtx();
  const [tests, resources, tasks] = await Promise.all([listTests(ctx), listResources(ctx), listTasks(ctx)]);
  const study = resources.filter((r) => r.entity_type === "study" || r.entity_type === "test");
  const subjects = Array.from(new Set(tests.map((t) => t.subject))).sort();
  return (
    <div>
      <PageHeader
        title="Tests"
        description="Theory and practical exams, preparation status and the material you need for each."
        actions={
          <>
            <LinkButton href="/tests/materials" size="md"><FolderOpen className="size-4" />Open Study Materials</LinkButton>
            <TestFormDialog subjects={subjects} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 [&>*]:min-w-0 xl:grid-cols-[1fr_320px]">
        <TestsView tests={tests} resources={study} tasks={tasks} />
        <aside className="space-y-4">
          <AIShortcuts />
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Study Material Helper</h2>
              <LinkButton href="/tests/materials" variant="ghost">View all</LinkButton>
            </div>
            <p className="mt-0.5 text-2xs text-subtle">{study.length} saved · notes, PDFs, PYQs, slides and links</p>
            <StudyLinks />
            <div className="mt-2">
              {study.length ? <ResourceList resources={study.slice(0, 5)} kinds={STUDY_RESOURCE_KINDS} compact /> : <p className="py-3 text-sm text-muted">Nothing saved yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
