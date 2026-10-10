import { Sparkles } from "lucide-react";
import { getCtx } from "@/lib/context";
import { fmt } from "@/lib/dates";
import { listLearning } from "@/lib/services/learning";
import { Badge, EmptyState, PageHeader } from "@/components/ui/bits";
import { LinkButton } from "@/components/ui/link-button";

export const metadata = { title: "Learning history" };

export default async function LearningPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const ctx = await getCtx();
  const { filter } = await searchParams;
  const all = await listLearning(ctx);
  const list = filter === "saved" ? all.filter((t) => t.is_saved) : filter === "unread" ? all.filter((t) => !t.is_read) : all;
  return (
    <div>
      <PageHeader title="Diva Keeps Learning" description={`${all.length} daily topic${all.length === 1 ? "" : "s"} so far · ${all.filter((t) => t.is_read).length} read · ${all.filter((t) => t.is_saved).length} saved`} />
      <div className="mb-4 flex gap-1.5">
        {[{ k: undefined, l: "All" }, { k: "saved", l: "Saved" }, { k: "unread", l: "Unread" }].map((f) => (
          <LinkButton key={f.l} href={f.k ? `/learning?filter=${f.k}` : "/learning"} variant={filter === f.k ? "primary" : "secondary"}>{f.l}</LinkButton>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nothing here yet">Each day&apos;s generated topic is stored here with its date.</EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <details key={t.id} className="card group p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                <span className="num w-[72px] text-2xs text-subtle">{fmt.dayWithYear(t.generated_for)}</span>
                <span className="min-w-0 flex-1 font-medium group-open:text-accent">{t.title}</span>
                <span className="text-2xs text-subtle">{t.category}</span>
                {t.is_saved && <Badge tone="accent">Saved</Badge>}
                {t.is_read && <Badge tone="ok">Read</Badge>}
              </summary>
              <div className="prose-diva mt-3 max-w-3xl text-[13.5px] text-fg/85">{t.content.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
              <p className="max-w-3xl rounded-md border-l-2 border-accent bg-accent/[0.06] px-3 py-2 text-[13px] font-medium">{t.key_takeaway}</p>
              {(t.source_url || t.further_reading.length > 0) && (
                <ul className="mt-2 flex flex-wrap gap-3 text-[13px]">
                  {[...(t.source_url ? [{ title: "Source", url: t.source_url }] : []), ...t.further_reading].map((r) => <li key={r.url}><a className="text-accent hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a></li>)}
                </ul>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
