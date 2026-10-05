import { cn } from "@/lib/cn";
import { PRIORITY_LABEL } from "@/lib/constants";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUp, Minus } from "lucide-react";

export function Badge({ children, className, tone = "neutral", title }: { children: React.ReactNode; className?: string; tone?: "neutral" | "accent" | "danger" | "warn" | "ok" | "outline"; title?: string }) {
  const tones = {
    neutral: "bg-surface-3 text-muted",
    accent: "bg-accent/15 text-accent",
    danger: "bg-danger/15 text-danger",
    warn: "bg-warn/15 text-warn",
    ok: "bg-ok/15 text-ok",
    outline: "border border-border text-muted",
  };
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-2xs font-medium [&_svg]:size-3", tones[tone], className)}>
      {children}
    </span>
  );
}

export function CategoryDot({ color, className, label }: { color: string; className?: string; label?: string }) {
  return (
    <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} aria-hidden={!label} aria-label={label} role={label ? "img" : undefined} />
  );
}

export function CategoryTag({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted">
      <CategoryDot color={color} />
      {name}
    </span>
  );
}

const PRIO_ICON = { urgent: AlertTriangle, high: ChevronsUp, medium: ArrowUp, low: ArrowDown } as const;
export function PriorityBadge({ priority, compact }: { priority: string; compact?: boolean }) {
  const Icon = PRIO_ICON[priority as keyof typeof PRIO_ICON] ?? Minus;
  const tone = priority === "urgent" ? "danger" : priority === "high" ? "warn" : "neutral";
  return (
    <Badge tone={tone} title={`${PRIORITY_LABEL[priority]} priority`}>
      <Icon aria-hidden />
      {compact ? <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span> : PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function ProgressBar({ value, className, color, label }: { value: number; className?: string; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: color ?? "rgb(var(--accent))" }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-8 text-center", className)}>
      {Icon && <Icon className="mb-2 size-5 text-subtle" />}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-xs text-muted">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SectionCard({ title, icon: Icon, actions, children, className, bodyClassName, id }: { title: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn("card flex min-w-0 flex-col", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="flex min-w-0 items-center gap-2 section-title">
          {Icon && <Icon className="size-4 shrink-0 text-subtle" />}
          <span className="truncate">{title}</span>
        </h2>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className={cn("min-h-0 flex-1 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmailStatusBadge({ status, title }: { status: string; title?: string }) {
  const map: Record<string, { label: string; tone: "neutral" | "accent" | "danger" | "warn" | "ok" | "outline" }> = {
    pending: { label: "Email scheduled", tone: "outline" },
    sending: { label: "Sending…", tone: "warn" },
    sent: { label: "Emailed", tone: "ok" },
    failed: { label: "Email failed", tone: "danger" },
    cancelled: { label: "Email cancelled", tone: "neutral" },
    skipped: { label: "No email", tone: "neutral" },
    off: { label: "No email", tone: "neutral" },
    unconfigured: { label: "Email not configured", tone: "warn" },
  };
  const m = map[status] ?? map.off;
  return <Badge tone={m.tone} title={title}>{m.label}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent", className)} aria-label="Loading" role="status" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surface-3", className)} />;
}
