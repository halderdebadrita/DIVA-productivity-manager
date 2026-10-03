// Shared domain types — mirror supabase/schema.sql exactly.

export type ID = string;

export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "not_started" | "in_progress" | "done";
export type TaskSource = "manual" | "side_quest" | "hackathon_followup" | "milestone";
export type ProjectStatus = "planning" | "in_progress" | "paused" | "completed";
export type TestType = "theory" | "practical";
export type PrepStatus = "not_started" | "studying" | "revision" | "prepared";
export type HackathonStatus = "registered" | "preparing" | "in_progress" | "submitted" | "completed";
export type EmailStatus = "pending" | "sending" | "sent" | "failed" | "cancelled" | "skipped";
export type ReminderEntity = "task" | "test" | "project" | "milestone" | "hackathon";

export interface ReminderPrefs {
  email_enabled: boolean;
  email: string | null; // null => profile email
  send_hour: number; // 0-23 local
  task_offsets: number[]; // days before due date
  test_offsets: number[];
  project_offsets: number[];
  hackathon_offsets: number[];
  followup_offsets: number[];
}

export interface Profile {
  id: ID;
  display_name: string;
  email: string | null;
  timezone: string;
  preferences: Record<string, unknown>;
  reminder_prefs: Partial<ReminderPrefs>;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: ID;
  user_id: ID;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: ID;
  user_id: ID;
  title: string;
  description: string | null;
  category_id: ID;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null; // yyyy-MM-dd (user tz)
  due_time: string | null; // HH:mm
  estimated_minutes: number | null;
  project_id: ID | null;
  milestone_id: ID | null;
  test_id: ID | null;
  hackathon_id: ID | null;
  link_url: string | null;
  email_reminder: "default" | "off";
  source: TaskSource;
  source_key: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectOutcome {
  summary?: string;
  final_stack?: string;
  key_features?: string;
  accomplishments?: string;
}

export interface Project {
  id: ID;
  user_id: ID;
  name: string;
  description: string | null;
  objective: string | null;
  tech_stack: string[];
  status: ProjectStatus;
  progress: number;
  progress_mode: "manual" | "milestones" | "github";
  start_date: string | null;
  deadline: string | null;
  repo_url: string | null;
  demo_url: string | null;
  presentation_url: string | null;
  docs_url: string | null;
  video_url: string | null;
  blockers: string | null;
  notes: string | null;
  outcome: ProjectOutcome;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: ID;
  user_id: ID;
  project_id: ID;
  title: string;
  description: string | null;
  status: "pending" | "done";
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Test {
  id: ID;
  user_id: ID;
  name: string;
  subject: string;
  type: TestType;
  test_date: string;
  test_time: string | null;
  prep_status: PrepStatus;
  syllabus: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Hackathon {
  id: ID;
  user_id: ID;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  submission_deadline: string | null;
  submission_time: string | null;
  status: HackathonStatus;
  team_name: string | null;
  team_members: string | null;
  repo_url: string | null;
  demo_url: string | null;
  presentation_url: string | null;
  submission_url: string | null;
  canva_url: string | null;
  project_description: string | null;
  milestones: string | null;
  brain_dump: string | null;
  results: string | null;
  achievements: string | null;
  retrospective: string | null;
  final_demo_url: string | null;
  certificate_url: string | null;
  completed_at: string | null;
  completion_count: number;
  created_at: string;
  updated_at: string;
}

export type ResourceEntity = "test" | "hackathon" | "project" | "study";

export interface Resource {
  id: ID;
  user_id: ID;
  title: string;
  kind: string;
  subject: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  entity_type: ResourceEntity | null;
  entity_id: ID | null;
  section: string | null;
  created_at: string;
}

export interface LearningTopic {
  id: ID;
  user_id: ID;
  title: string;
  category: string;
  content: string;
  key_takeaway: string;
  source_url: string | null;
  further_reading: { title: string; url: string }[];
  generated_for: string;
  provider: string | null;
  model: string | null;
  is_read: boolean;
  is_saved: boolean;
  created_at: string;
}

export interface SideQuest {
  id: ID;
  user_id: ID;
  title: string;
  description: string;
  category: string;
  estimated_minutes: number;
  completion_criterion: string;
  status: "suggested" | "active" | "completed" | "skipped";
  source: "ai" | "fallback";
  task_id: ID | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Reminder {
  id: ID;
  user_id: ID;
  entity_type: ReminderEntity;
  entity_id: ID;
  reminder_type: string;
  title: string;
  event_date: string;
  event_time: string | null;
  offset_days: number;
  remind_at: string;
  timezone: string;
  priority: string;
  category_slug: string | null;
  in_app_state: "active" | "acknowledged" | "resolved";
  email_status: EmailStatus;
  email_attempts: number;
  next_attempt_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  provider_message_id: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface GithubSnapshot {
  project_id: ID;
  user_id: ID;
  repo_full_name: string;
  data: GithubData | null;
  synced_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  updated_at: string;
}

export interface GithubData {
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  stars: number;
  forks: number;
  open_issues: number;
  language: string | null;
  pushed_at: string | null;
  private: boolean;
  commits: { sha: string; message: string; author: string | null; date: string | null; url: string }[];
  releases: { name: string; tag: string; url: string; published_at: string | null }[];
  issues: { number: number; title: string; url: string; state: string }[];
  languages?: Record<string, number>;
  homepage?: string | null;
  created_at?: string | null;
  topics?: string[];
  analysis?: GithubAnalysis | null;
  analysis_error?: string | null;
  analysis_error_at?: string | null;
}

export interface GithubAnalysis {
  summary: string;
  objective: string;
  tech_stack: string[];
  status: "planning" | "in_progress" | "paused" | "completed";
  progress: number;
  progress_reason: string;
  done: string[];
  remaining: string[];
  analyzed_at: string;
  pushed_at: string | null; // repo state the analysis was based on
  model: string;
  applied: { description?: string; objective?: string }; // what Diva wrote into the project, to detect your own edits
}

export type TableName =
  | "profiles"
  | "categories"
  | "tasks"
  | "projects"
  | "project_milestones"
  | "tests"
  | "hackathons"
  | "resources"
  | "learning_topics"
  | "side_quests"
  | "reminders"
  | "github_snapshots";
