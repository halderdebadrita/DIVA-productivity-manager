"use server";
import { z } from "zod";
import {
  hackathonDetailsInput, hackathonInput, hackathonOutcomeInput, milestoneInput, projectInput, testInput, optUrl,
} from "@/lib/validation";
import { createTest, deleteTest, updateTest } from "@/lib/services/tests";
import {
  createMilestone, createProject, deleteMilestone, deleteProject, setProjectPinned, updateMilestone, updateProject,
} from "@/lib/services/projects";
import { createHackathon, deleteHackathon, updateHackathon } from "@/lib/services/hackathons";
import { analyzeProject, autoRefresh, importRepos, myRepos, remainingToMilestones, syncGithub } from "@/lib/services/github";
import { run } from "./_run";

// ---- Tests
export async function saveTestAction(id: string | null, raw: unknown) {
  return run(async (ctx) => {
    const input = testInput.parse(raw);
    return id ? updateTest(ctx, id, input) : createTest(ctx, input);
  });
}
export async function setPrepStatusAction(id: string, prep: string) {
  return run(async (ctx) => updateTest(ctx, id, { prep_status: z.enum(["not_started", "studying", "revision", "prepared"]).parse(prep) }));
}
export async function deleteTestAction(id: string) {
  return run((ctx) => deleteTest(ctx, id));
}

// ---- Projects
export async function saveProjectAction(id: string | null, raw: unknown) {
  return run(async (ctx) => {
    const input = projectInput.parse(raw);
    return id ? updateProject(ctx, id, input) : createProject(ctx, input);
  });
}
const projectPatch = z.object({
  blockers: z.string().max(20000).nullable().optional(),
  notes: z.string().max(50000).nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["planning", "in_progress", "paused", "completed"]).optional(),
  demo_url: optUrl.optional(),
  video_url: optUrl.optional(),
  presentation_url: optUrl.optional(),
  docs_url: optUrl.optional(),
  outcome: z
    .object({ summary: z.string().max(5000).optional(), final_stack: z.string().max(1000).optional(), key_features: z.string().max(5000).optional(), accomplishments: z.string().max(5000).optional() })
    .optional(),
});
export async function patchProjectAction(id: string, raw: unknown) {
  return run((ctx) => updateProject(ctx, id, projectPatch.parse(raw)));
}
export async function deleteProjectAction(id: string) {
  return run((ctx) => deleteProject(ctx, id));
}
export async function pinProjectAction(id: string, pinned: boolean) {
  return run((ctx) => setProjectPinned(ctx, id, z.boolean().parse(pinned)));
}
export async function saveMilestoneAction(projectId: string, id: string | null, raw: unknown) {
  return run(async (ctx) => {
    const input = milestoneInput.parse(raw);
    return id ? updateMilestone(ctx, id, input) : createMilestone(ctx, projectId, input);
  });
}
export async function toggleMilestoneAction(id: string, done: boolean) {
  return run((ctx) => updateMilestone(ctx, id, { status: done ? "done" : "pending" }));
}
export async function deleteMilestoneAction(id: string) {
  return run((ctx) => deleteMilestone(ctx, id));
}
export async function syncGithubAction(projectId: string) {
  return run((ctx) => syncGithub(ctx, projectId));
}

// ---- Hackathons
export async function saveHackathonAction(id: string | null, raw: unknown) {
  return run(async (ctx) => {
    const input = hackathonInput.parse(raw);
    if (!id) return { hackathon: await createHackathon(ctx, input), followup: null };
    return updateHackathon(ctx, id, input);
  });
}
export async function setHackathonStatusAction(id: string, status: string) {
  return run(async (ctx) => {
    const s = z.enum(["registered", "preparing", "in_progress", "submitted", "completed"]).parse(status);
    const r = await updateHackathon(ctx, id, { status: s });
    return { followupCreated: Boolean(r.followup?.created), followupDue: r.followup?.task.due_date ?? null };
  });
}
export async function saveBrainDumpAction(id: string, text: string) {
  return run((ctx) => updateHackathon(ctx, id, { brain_dump: z.string().max(100000).parse(text) }), { revalidate: false });
}
export async function saveHackathonDetailsAction(id: string, raw: unknown) {
  return run((ctx) => updateHackathon(ctx, id, hackathonDetailsInput.parse(raw)));
}
export async function saveHackathonOutcomeAction(id: string, raw: unknown) {
  return run((ctx) => updateHackathon(ctx, id, hackathonOutcomeInput.parse(raw)));
}
export async function deleteHackathonAction(id: string) {
  return run((ctx) => deleteHackathon(ctx, id));
}

// ---- GitHub account
export async function listMyReposAction() {
  return run((ctx) => myRepos(ctx), { revalidate: false });
}
export async function importReposAction(fullNames: string[]) {
  return run((ctx) => importRepos(ctx, z.array(z.string().max(200)).max(50).parse(fullNames)));
}
export async function analyzeProjectAction(projectId: string) {
  return run((ctx) => analyzeProject(ctx, projectId));
}
export async function autoRefreshAction(projectId?: string) {
  return run((ctx) => autoRefresh(ctx, { projectId, limit: projectId ? 1 : 6, maxAgeHours: projectId ? 0 : 1 }));
}
export async function remainingToMilestonesAction(projectId: string, items: string[]) {
  return run((ctx) => remainingToMilestones(ctx, projectId, z.array(z.string().max(200)).max(12).parse(items)));
}
