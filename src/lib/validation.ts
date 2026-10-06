import { z } from "zod";

const trimmed = (max = 500) => z.string().trim().max(max);
const optText = (max = 20000) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Use a valid date");
export const optDate = z.preprocess((v) => (v === "" || v === undefined ? null : v), dateStr.nullable());
export const optTime = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time (HH:mm)").nullable(),
);

export const httpUrl = z
  .string()
  .trim()
  .url("Enter a full URL starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed");
export const optUrl = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v ?? null), httpUrl.nullable());
const optId = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().min(1).nullable());
const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );

export const taskInput = z.object({
  title: trimmed(200).min(1, "Give the task a title"),
  description: optText(),
  category_id: z.string().min(1, "Choose a category"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["not_started", "in_progress", "done"]).default("not_started"),
  due_date: optDate,
  due_time: optTime,
  estimated_minutes: optInt(1, 60 * 24 * 7),
  project_id: optId,
  milestone_id: optId,
  test_id: optId,
  hackathon_id: optId,
  link_url: optUrl,
  email_reminder: z.enum(["default", "off"]).default("default"),
});
export type TaskInput = z.infer<typeof taskInput>;

export const testInput = z.object({
  name: trimmed(200).min(1, "Name the test"),
  subject: trimmed(120).min(1, "Add the subject"),
  type: z.enum(["theory", "practical"]),
  test_date: dateStr,
  test_time: optTime,
  prep_status: z.enum(["not_started", "studying", "revision", "prepared"]).default("not_started"),
  syllabus: optText(),
  notes: optText(),
});

export const projectInput = z.object({
  name: trimmed(200).min(1, "Name the project"),
  description: optText(),
  objective: optText(),
  tech_stack: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v ?? []),
    z.array(z.string().max(60)).max(30),
  ),
  status: z.enum(["planning", "in_progress", "paused", "completed"]).default("planning"),
  progress: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(100)),
  progress_mode: z.enum(["manual", "milestones", "github"]).default("manual"),
  start_date: optDate,
  deadline: optDate,
  repo_url: optUrl,
  demo_url: optUrl,
  presentation_url: optUrl,
  docs_url: optUrl,
  video_url: optUrl,
});

export const milestoneInput = z.object({
  title: trimmed(200).min(1, "Name the milestone"),
  description: optText(),
  due_date: optDate,
});

export const hackathonInput = z.object({
  name: trimmed(200).min(1, "Name the hackathon"),
  description: optText(),
  start_date: optDate,
  end_date: optDate,
  registration_deadline: optDate,
  submission_deadline: optDate,
  submission_time: optTime,
  status: z.enum(["registered", "preparing", "in_progress", "submitted", "completed"]).default("registered"),
  team_name: optText(200),
  team_members: optText(2000),
});

export const hackathonDetailsInput = z.object({
  repo_url: optUrl,
  demo_url: optUrl,
  presentation_url: optUrl,
  submission_url: optUrl,
  canva_url: optUrl.refine((u) => !u || /canva\.(com|link)/i.test(u), "That doesn't look like a Canva link"),
  project_description: optText(),
  team_name: optText(200),
  team_members: optText(2000),
  milestones: optText(),
});

export const hackathonOutcomeInput = z.object({
  results: optText(),
  achievements: optText(),
  retrospective: optText(),
  final_demo_url: optUrl,
  certificate_url: optUrl,
});

export const resourceLinkInput = z.object({
  title: trimmed(200).min(1, "Add a title"),
  kind: trimmed(40).min(1),
  subject: optText(120),
  url: httpUrl,
  description: optText(2000),
  entity_type: z.enum(["test", "hackathon", "project", "study"]).nullable(),
  entity_id: optId,
  section: optText(40),
});

export const learningSchema = z.object({
  title: z.string().min(3).max(140),
  category: z.string().min(2).max(60),
  content: z.string().min(600).max(2400),
  key_takeaway: z.string().min(10).max(400),
  source_url: z.string().url().nullable().optional(),
  further_reading: z
    .array(z.object({ title: z.string().min(1).max(160), url: z.string().url() }))
    .max(4)
    .optional()
    .default([]),
});
export type LearningOut = z.infer<typeof learningSchema>;

export const sideQuestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(600),
  category: z.string().min(2).max(40),
  estimated_minutes: z.number().int().min(15).max(120),
  completion_criterion: z.string().min(5).max(300),
});
export type SideQuestOut = z.infer<typeof sideQuestSchema>;

export const reminderPrefsInput = z.object({
  email_enabled: z.boolean(),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().email("Enter a valid email").nullable()),
  send_hour: z.number().int().min(0).max(23),
  task_offsets: z.array(z.number().int().min(0).max(30)).max(4),
  test_offsets: z.array(z.number().int().min(0).max(30)).max(4),
  project_offsets: z.array(z.number().int().min(0).max(30)).max(4),
  hackathon_offsets: z.array(z.number().int().min(0).max(30)).max(4),
  followup_offsets: z.array(z.number().int().min(0).max(30)).max(4),
});

export function firstError(e: z.ZodError) {
  const i = e.issues[0];
  return i ? i.message : "Invalid input";
}
