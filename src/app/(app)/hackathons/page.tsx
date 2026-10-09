import { Trophy } from "lucide-react";
import { getCtx, catBySlug } from "@/lib/context";
import { todayIn } from "@/lib/dates";
import { listHackathons } from "@/lib/services/hackathons";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { QuickLinkButton } from "@/components/shell/quick-link";
import { HackathonCard } from "@/components/hackathons/hackathon-card";
import { HackathonFormDialog } from "@/components/hackathons/hackathon-form";

export const metadata = { title: "Hackathons" };

export default async function HackathonsPage() {
  const ctx = await getCtx();
  const all = await listHackathons(ctx);
  const today = todayIn(ctx.tz);
  const color = catBySlug(ctx, "hackathons").color;
  const key = (d: string | null) => d ?? "9999";
  const active = all.filter((h) => h.status !== "completed").sort((a, b) => key(a.submission_deadline ?? a.start_date).localeCompare(key(b.submission_deadline ?? b.start_date)));
  const completed = all.filter((h) => h.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  return (
    <div>
      <PageHeader
        title="Hackathons"
        description="From registration to submission to the certificate on LinkedIn."
        actions={
          <>
            <QuickLinkButton k="hackathon_platform" />
            <QuickLinkButton k="canva" />
            <QuickLinkButton k="claude_code" />
            <HackathonFormDialog />
          </>
        }
      />
      <p className="-mt-3 mb-5 text-2xs text-subtle">Shortcuts open your own signed-in accounts in a new tab (edit them in Settings → Quick links). Claude Code opens on the web — the browser can&apos;t start a local CLI session.</p>

      <section aria-labelledby="active-h">
        <h2 id="active-h" className="mb-3 eyebrow">Active & upcoming · {active.length}</h2>
        {active.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{active.map((h) => <HackathonCard key={h.id} h={h} today={today} color={color} tz={ctx.tz} />)}</div>
        ) : (
          <EmptyState icon={Trophy} title="No active hackathons" action={<HackathonFormDialog />}>Add one to get a workspace for ideas, resources, submission links and certificates.</EmptyState>
        )}
      </section>

      <details className="group mt-8" open={completed.length <= 3}>
        <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 eyebrow hover:text-muted">
          <span className="transition-transform group-open:rotate-90">›</span>Completed · {completed.length}
        </summary>
        {completed.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{completed.map((h) => <HackathonCard key={h.id} h={h} today={today} color={color} tz={ctx.tz} />)}</div>
        ) : (
          <p className="text-sm text-muted">Completed hackathons move here automatically — nothing is deleted.</p>
        )}
      </details>
    </div>
  );
}
