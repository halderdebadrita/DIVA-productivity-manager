import { getCtx } from "@/lib/context";
import { effectiveProgress, listMilestones, listProjects, nextMilestone, pinnedProjectIds } from "@/lib/services/projects";
import type { GithubSnapshot } from "@/lib/types";
import { PageHeader } from "@/components/ui/bits";
import { ProjectFormDialog } from "@/components/projects/project-form";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { QuickLinkButton } from "@/components/shell/quick-link";
import { GithubAutoRefresh, GithubImport } from "@/components/projects/github-import";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await getCtx();
  const [projects, milestones, snaps] = await Promise.all([
    listProjects(ctx),
    listMilestones(ctx),
    ctx.db.select<GithubSnapshot>("github_snapshots", { eq: { user_id: ctx.userId } }),
  ]);
  const data = projects.map((p) => {
    const s = snaps.find((x) => x.project_id === p.id);
    return { ...p, effective: effectiveProgress(p, milestones), next: nextMilestone(p, milestones) ?? null, syncedAt: s?.synced_at ?? null, pushedAt: s?.data?.pushed_at ?? null };
  });
  return (
    <div>
      <PageHeader title="Projects" description="Your personal project tracker — progress, milestones, GitHub and demos in one workspace each." actions={<><QuickLinkButton k="github" label="My GitHub" /><QuickLinkButton k="claude_code" /><GithubImport /><ProjectFormDialog /></>} />
      <GithubAutoRefresh />
      <ProjectsGrid projects={data} pinned={pinnedProjectIds(ctx)} />
    </div>
  );
}
