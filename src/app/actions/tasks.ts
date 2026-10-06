"use server";
import { taskInput } from "@/lib/validation";
import { createTask, deleteTask, getTask, setTaskDone, updateTask } from "@/lib/services/tasks";
import { run } from "./_run";

export async function saveTaskAction(id: string | null, raw: unknown) {
  return run(async (ctx) => {
    const input = taskInput.parse(raw);
    if (id) return updateTask(ctx, id, input);
    return (await createTask(ctx, { ...input, source: "manual" })).task;
  });
}

export async function quickAddTaskAction(raw: unknown) {
  return run(async (ctx) => {
    const input = taskInput.parse(raw);
    return (await createTask(ctx, { ...input, source: "manual" })).task;
  });
}

export async function toggleTaskAction(id: string, done: boolean) {
  return run((ctx) => setTaskDone(ctx, id, done));
}

export async function setTaskStatusAction(id: string, status: "not_started" | "in_progress" | "done") {
  return run((ctx) => updateTask(ctx, id, { status }));
}

export async function deleteTaskAction(id: string) {
  return run((ctx) => deleteTask(ctx, id));
}

export async function fetchTaskAction(id: string) {
  return run((ctx) => getTask(ctx, id), { revalidate: false });
}
