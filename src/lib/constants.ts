import type { HackathonStatus, PrepStatus, Priority, ProjectStatus, ReminderPrefs, TaskStatus } from "./types";

export const APP_NAME = "Diva";

export const DEFAULT_CATEGORIES = [
  { slug: "academics", name: "Academics", color: "#7AA7FF", sort_order: 1 },
  { slug: "tests", name: "Tests & Exams", color: "#FFB347", sort_order: 2 },
  { slug: "projects", name: "Projects", color: "#B794FF", sort_order: 3 },
  { slug: "hackathons", name: "Hackathons", color: "#FF7EB6", sort_order: 4 },
  { slug: "personal", name: "Personal", color: "#4FD1A1", sort_order: 5 },
  { slug: "learning", name: "Learning", color: "#4CC9F0", sort_order: 6 },
  { slug: "other", name: "Other", color: "#A3A8B8", sort_order: 7 },
] as const;

export const PRIORITIES: { value: Priority; label: string; rank: number }[] = [
  { value: "urgent", label: "Urgent", rank: 0 },
  { value: "high", label: "High", rank: 1 },
  { value: "medium", label: "Medium", rank: 2 },
  { value: "low", label: "Low", rank: 3 },
];
export const PRIORITY_RANK: Record<string, number> = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.rank]));
export const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]));

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];
export const TASK_STATUS_LABEL = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s.label])) as Record<TaskStatus, string>;

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "planning", label: "Planning", color: "#7AA7FF" },
  { value: "in_progress", label: "In Progress", color: "#D6FF70" },
  { value: "paused", label: "Paused", color: "#A3A8B8" },
  { value: "completed", label: "Completed", color: "#4FD1A1" },
];
export const PROJECT_STATUS_LABEL = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.value, s.label])) as Record<ProjectStatus, string>;

export const PREP_STATUSES: { value: PrepStatus; label: string; pct: number }[] = [
  { value: "not_started", label: "Not Started", pct: 0 },
  { value: "studying", label: "Studying", pct: 40 },
  { value: "revision", label: "Revision", pct: 75 },
  { value: "prepared", label: "Prepared", pct: 100 },
];
export const PREP_LABEL = Object.fromEntries(PREP_STATUSES.map((s) => [s.value, s.label])) as Record<PrepStatus, string>;

export const HACKATHON_STATUSES: { value: HackathonStatus; label: string }[] = [
  { value: "registered", label: "Registered" },
  { value: "preparing", label: "Preparing" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "completed", label: "Completed" },
];
export const HACKATHON_STATUS_LABEL = Object.fromEntries(HACKATHON_STATUSES.map((s) => [s.value, s.label])) as Record<HackathonStatus, string>;

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  email_enabled: true,
  email: null,
  send_hour: 8,
  task_offsets: [1, 0],
  test_offsets: [3, 1],
  project_offsets: [3, 0],
  hackathon_offsets: [2, 0],
  followup_offsets: [0],
};

export const STUDY_RESOURCE_KINDS = [
  { value: "notes", label: "Notes" },
  { value: "pdf", label: "PDF" },
  { value: "pyq", label: "PYQs" },
  { value: "slides", label: "Lecture slides" },
  { value: "link", label: "Reference link" },
  { value: "other", label: "Other" },
];

export const HACKATHON_RESOURCE_KINDS = [
  { value: "presentation", label: "Presentation" },
  { value: "canva", label: "Canva link" },
  { value: "problem_statement", label: "Problem statement" },
  { value: "research", label: "Research document" },
  { value: "submission", label: "Submission document" },
  { value: "screenshot", label: "Screenshot" },
  { value: "certificate", label: "Certificate" },
  { value: "other", label: "Other" },
];

export const PROJECT_RESOURCE_KINDS = [
  { value: "documentation", label: "Documentation" },
  { value: "architecture", label: "Architecture notes" },
  { value: "decision", label: "Technical decision" },
  { value: "research", label: "Research" },
  { value: "screenshot", label: "Screenshot" },
  { value: "demo", label: "Demo / video" },
  { value: "presentation", label: "Presentation" },
  { value: "file", label: "File" },
  { value: "other", label: "Other" },
];

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/zip",
];
