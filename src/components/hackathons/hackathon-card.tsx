import Link from "next/link";
import { CalendarRange, CheckCircle2, Clock, GitBranch, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { HACKATHON_STATUS_LABEL } from "@/lib/constants";
import { dateInTz, daysBetween, fmt } from "@/lib/dates";
import type { Hackathon } from "@/lib/types";
import { Badge } from "@/components/ui/bits";

export function HackathonCard({ h, today, color, tz }: { h: Hackathon; today: string; color: string; tz: string }) {
  const done = h.status === "completed";
  const dleft = h.submission_deadline ? daysBetween(today, h.submission_deadline) : null;
  return (
    <Link href={`/hackathons/${h.id}`} className={cn("card group relative flex flex-col overflow-hidden p-4 transition-colors hover:border-border-strong", done && "opacity-80")}>
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight group-hover:underline">{h.name}</h3>
        <Badge tone={done ? "ok" : h.status === "submitted" ? "accent" : "outline"}>{done && <CheckCircle2 aria-hidden />}{HACKATHON_STATUS_LABEL[h.status]}</Badge>
      </div>
      {h.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{h.description}</p>}
      <div className="mt-3 space-y-1.5 text-xs text-muted">
        {(h.start_date || h.end_date) && (
          <p className="flex items-center gap-1.5"><CalendarRange className="size-3.5 text-subtle" />{h.start_date ? fmt.day(h.start_date) : "TBA"}{h.end_date && h.end_date !== h.start_date ? ` – ${fmt.day(h.end_date)}` : ""}</p>
        )}
        {h.submission_deadline && (
          <p className={cn("flex items-center gap-1.5", !done && h.status !== "submitted" && dleft !== null && dleft <= 2 && dleft >= 0 && "text-accent", !done && h.status !== "submitted" && dleft !== null && dleft < 0 && "text-danger")}>
            <Clock className="size-3.5 text-subtle" />Submit by {fmt.day(h.submission_deadline)}{h.submission_time ? `, ${fmt.time(h.submission_time)}` : ""}
            {!done && h.status !== "submitted" && dleft !== null && dleft >= 0 && <span className="text-subtle">· {dleft === 0 ? "today" : `${dleft}d left`}</span>}
          </p>
        )}
        {(h.team_name || h.team_members) && <p className="flex items-center gap-1.5 truncate"><Users className="size-3.5 shrink-0 text-subtle" /><span className="truncate">{[h.team_name, h.team_members].filter(Boolean).join(" · ")}</span></p>}
        {h.repo_url && <p className="flex items-center gap-1.5 truncate"><GitBranch className="size-3.5 text-subtle" /><span className="truncate">{h.repo_url.replace(/^https?:\/\/(www\.)?/, "")}</span></p>}
      </div>
      {done && h.completed_at && <p className="mt-3 border-t border-border pt-2 text-2xs text-subtle">Completed {fmt.dayWithYear(dateInTz(h.completed_at, tz))}{h.results ? ` · ${h.results}` : ""}</p>}
    </Link>
  );
}
