import type { Task } from "./types";
const R: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export const sortChronologicalClient = (a: Task, b: Task) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (R[a.priority] ?? 2) - (R[b.priority] ?? 2) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99");
