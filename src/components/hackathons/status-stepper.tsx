"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { HACKATHON_STATUSES } from "@/lib/constants";
import type { HackathonStatus } from "@/lib/types";
import { setHackathonStatusAction } from "@/app/actions/entities";

export function StatusStepper({ id, status }: { id: string; status: HackathonStatus }) {
  const [pending, start] = useTransition();
  const idx = HACKATHON_STATUSES.findIndex((s) => s.value === status);
  return (
    <div role="radiogroup" aria-label="Hackathon status" className={cn("grid grid-cols-5 gap-1", pending && "pointer-events-none opacity-60")}>
      {HACKATHON_STATUSES.map((s, i) => (
        <button
          key={s.value}
          role="radio"
          aria-checked={s.value === status}
          onClick={() =>
            s.value !== status &&
            start(async () => {
              const r = await setHackathonStatusAction(id, s.value);
              if (!r.ok) return void toast.error(r.error);
              if (r.data.followupCreated) toast.success("Hackathon completed 🎉", { description: `Follow-up task "Upload hackathon certificate to LinkedIn" is due ${r.data.followupDue}.` });
              else toast.success(`Status: ${s.label}`);
            })
          }
          className={cn(
            "flex items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium transition-colors sm:text-xs",
            i < idx && "bg-accent/10 text-accent",
            i === idx && (s.value === "completed" ? "bg-ok text-[#0d1a12]" : "bg-accent text-accent-fg"),
            i > idx && "bg-surface-3 text-subtle hover:text-fg",
          )}
        >
          {i < idx && <Check className="size-3" />}
          {s.label}
        </button>
      ))}
    </div>
  );
}
