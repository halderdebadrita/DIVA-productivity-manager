import { ArrowLeft } from "lucide-react";
import { getCtx } from "@/lib/context";
import { listTests } from "@/lib/services/tests";
import { listResources } from "@/lib/services/resources";
import { STUDY_RESOURCE_KINDS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/bits";
import { LinkButton } from "@/components/ui/link-button";
import { ResourceBrowser } from "@/components/resources/resource-manager";

export const metadata = { title: "Study materials" };

export default async function MaterialsPage() {
  const ctx = await getCtx();
  const [tests, resources] = await Promise.all([listTests(ctx), listResources(ctx)]);
  const study = resources.filter((r) => r.entity_type === "study" || r.entity_type === "test");
  return (
    <div>
      <PageHeader
        title="Study Material Helper"
        description="Notes, PDFs, PYQs, lecture slides and reference links — searchable by subject and type. Files are stored privately."
        actions={<LinkButton href="/tests"><ArrowLeft className="size-4" />Back to tests</LinkButton>}
      />
      <ResourceBrowser resources={study} kinds={STUDY_RESOURCE_KINDS} tests={tests.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
