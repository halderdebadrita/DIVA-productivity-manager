"use client";
import { useState, useTransition } from "react";
import * as P from "@radix-ui/react-popover";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Dices, ListPlus, Play, Swords, Target, Timer, Trophy } from "lucide-react";
import { fmt } from "@/lib/dates";
import type { SideQuest } from "@/lib/types";
import { completeQuestAction, newQuestAction, questToTaskAction, startQuestAction } from "@/app/actions/misc";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, SectionCard } from "@/components/ui/bits";
import { useApp } from "@/components/shell/app-provider";

export function SideQuestCard({ current, completed }: { current: SideQuest | null; completed: SideQuest[] }) {
  const app = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);

  const act = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      setBusy(key);
      const r = await fn();
      setBusy(null);
      if (!r.ok) toast.error(r.error ?? "Failed");
      else if (success) toast.success(success);
    });

  const generate = () =>
    start(async () => {
      setBusy("new");
      const r = await newQuestAction();
      setBusy(null);
      if (!r.ok) return void toast.error(r.error);
      setAiError(r.data.error ?? null);
    });

  return (
    <SectionCard
      title="Side quest"
      icon={Swords}
      actions={
        <P.Root>
          <P.Trigger asChild>
            <Button size="sm" variant="ghost"><Trophy />{completed.length} done</Button>
          </P.Trigger>
          <P.Portal>
            <P.Content align="end" sideOffset={6} className="z-50 w-72 rounded-lg border border-border bg-surface p-2 shadow-2xl">
              <p className="px-2 pb-1 eyebrow">Completed quests</p>
              {completed.length ? (
                <ul className="max-h-64 overflow-y-auto">
                  {completed.map((q) => (
                    <li key={q.id} className="flex items-start gap-2 rounded px-2 py-1.5">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
                      <div className="min-w-0"><p className="truncate text-[13px]">{q.title}</p><p className="text-2xs text-subtle">{fmt.instant(q.completed_at, app.tz)}</p></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-2 py-4 text-center text-xs text-muted">Finish a quest to start your log.</p>}
            </P.Content>
          </P.Portal>
        </P.Root>
      }
    >
      {!current ? (
        <EmptyState icon={Dices} title="Got an hour?" action={<Button variant="primary" size="sm" loading={busy === "new"} onClick={generate}><Dices />Generate a quest</Button>}>
          Get one small, satisfying thing to do — tailored to your projects and tests.
        </EmptyState>
      ) : (
        <div>
          {(current.source === "fallback" || aiError) && (
            <p className="mb-3 flex items-start gap-2 rounded-md border border-warn/20 bg-warn/[0.06] px-3 py-2 text-2xs text-warn">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {app.integrations.ai ? `AI generation failed — this is a built-in quest. ${aiError ?? ""}` : "AI isn't configured — this is a built-in quest, not a personalised one."}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{current.category}</Badge>
            <Badge><Timer aria-hidden />~{current.estimated_minutes} min</Badge>
            {current.status === "active" && <Badge tone="ok"><Play aria-hidden />In progress</Badge>}
            {current.task_id && <Badge tone="outline">On task list</Badge>}
          </div>
          <h3 className="mt-2.5 text-[16px] font-semibold leading-snug tracking-tight">{current.title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{current.description}</p>
          <div className="mt-3 flex gap-2 rounded-md bg-surface-2 px-3 py-2.5">
            <Target className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-[13px]">{current.completion_criterion}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {current.status === "suggested" ? (
              <Button size="sm" variant="primary" loading={busy === "start"} onClick={() => act("start", () => startQuestAction(current.id), "Quest started — good luck!")}><Play />Start</Button>
            ) : (
              <Button size="sm" variant="primary" loading={busy === "done"} onClick={() => act("done", () => completeQuestAction(current.id), "Quest complete 🎉")}><CheckCircle2 />Mark complete</Button>
            )}
            {current.status === "suggested" && (
              <Button size="sm" loading={busy === "done"} onClick={() => act("done", () => completeQuestAction(current.id), "Quest complete 🎉")}><CheckCircle2 />Already done</Button>
            )}
            <Button size="sm" loading={busy === "new"} onClick={generate}><Dices />Another</Button>
            {!current.task_id && (
              <Button size="sm" variant="ghost" loading={busy === "task"} onClick={() => act("task", () => questToTaskAction(current.id), "Added to today's tasks")}><ListPlus />Add to tasks</Button>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
