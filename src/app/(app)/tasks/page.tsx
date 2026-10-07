import { getCtx } from "@/lib/context";
import { listTasks } from "@/lib/services/tasks";
import { listProjects, listMilestones, effectiveProgress, nextMilestone } from "@/lib/services/projects";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await getCtx();
  const [{ view }, tasks, projects, milestones] = await Promise.all([searchParams, listTasks(ctx), listProjects(ctx), listMilestones(ctx)]);
  const projectSummaries = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    progress: effectiveProgress(p, milestones),
    deadline: p.deadline,
    nextMilestone: nextMilestone(p, milestones) ?? null,
  }));
  return <TasksView tasks={tasks} projects={projectSummaries} milestones={milestones} initialView={view ?? "inbox"} />;
}
