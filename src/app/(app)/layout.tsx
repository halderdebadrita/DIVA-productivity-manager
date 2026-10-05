import { Suspense } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { getCtx } from "@/lib/context";
import { integrationStatus } from "@/lib/env";
import { todayIn } from "@/lib/dates";
import { loadAll } from "@/lib/services/agenda";
import { reminderPanel } from "@/lib/services/reminders";
import { AppProvider } from "@/components/shell/app-provider";
import { resolveQuickLinks } from "@/lib/quick-links";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { TaskDeepLink, TaskDialog } from "@/components/tasks/task-dialog";
import { AssistantBubble } from "@/components/assistant/assistant";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  const all = await loadAll(ctx);
  const msProject = new Map(all.milestones.map((m) => [m.id, m.project_id]));
  const reminders = await reminderPanel(ctx, { milestoneProject: msProject });
  const status = integrationStatus();
  const lookups = {
    categories: ctx.categories,
    projects: all.projects.map((p) => ({ id: p.id, name: p.name, status: p.status })),
    milestones: all.milestones.map((m) => ({ id: m.id, title: m.title, project_id: m.project_id })),
    tests: all.tests.map((t) => ({ id: t.id, name: t.name, subject: t.subject, test_date: t.test_date })),
    hackathons: all.hackathons.map((h) => ({ id: h.id, name: h.name, status: h.status })),
  };
  const info = {
    tz: ctx.tz,
    today: todayIn(ctx.tz),
    displayName: ctx.profile.display_name,
    email: ctx.reminderEmail,
    mode: ctx.mode,
    integrations: { ai: status.ai, email: status.email, github: status.github, cron: status.cron, supabase: status.supabase },
    links: Object.fromEntries(resolveQuickLinks(ctx.profile.preferences?.quick_links).map((l) => [l.key, l.url])),
  };
  return (
    <AppProvider lookups={lookups} info={info}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {ctx.mode === "demo" && (
            <div className="flex items-center justify-center gap-2 border-b border-warn/20 bg-warn/[0.07] px-4 py-1.5 text-center text-2xs text-warn">
              <FlaskConical className="size-3.5 shrink-0" />
              <span>Local mode — your data is saved on this computer in <code className="font-mono">.diva-data/</code>. Connect Supabase to sync and sign in from anywhere.</span>
              <Link href="/settings#integrations" className="underline underline-offset-2">Setup</Link>
            </div>
          )}
          <Topbar reminders={reminders} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
      <Suspense>
        <TaskDialog />
        <TaskDeepLink />
      </Suspense>
      <AssistantBubble />
    </AppProvider>
  );
}
