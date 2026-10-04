import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { TableName } from "../types";
import { DbError, type Db, type FileStore, type Filter, type SelectOptions } from "./types";

/**
 * Demo-mode persistence: a JSON file at .diva-data/db.json (git-ignored).
 * It enforces the same unique constraints and foreign-key behaviour as the
 * Postgres schema so business logic behaves identically in both modes.
 * Data here is completely separate from any Supabase project.
 */

const DATA_DIR = path.join(process.cwd(), ".diva-data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

const TABLES: TableName[] = [
  "profiles", "categories", "tasks", "projects", "project_milestones", "tests", "hackathons",
  "resources", "learning_topics", "side_quests", "reminders", "github_snapshots",
];

const PK: Partial<Record<TableName, string>> = { github_snapshots: "project_id" };

/** Unique constraints: [columns, partial condition] */
const UNIQUE: Partial<Record<TableName, { cols: string[]; when?: (r: Row) => boolean }[]>> = {
  categories: [{ cols: ["user_id", "slug"] }],
  tasks: [{ cols: ["user_id", "source_key"], when: (r) => r.source_key != null }],
  reminders: [{ cols: ["idempotency_key"] }],
  learning_topics: [{ cols: ["user_id", "generated_for"] }],
  github_snapshots: [{ cols: ["project_id"] }],
};

/** ON DELETE behaviour, mirroring schema.sql */
const FK: { parent: TableName; child: TableName; col: string; action: "cascade" | "set null" | "restrict" }[] = [
  { parent: "projects", child: "project_milestones", col: "project_id", action: "cascade" },
  { parent: "projects", child: "tasks", col: "project_id", action: "set null" },
  { parent: "projects", child: "github_snapshots", col: "project_id", action: "cascade" },
  { parent: "project_milestones", child: "tasks", col: "milestone_id", action: "set null" },
  { parent: "tests", child: "tasks", col: "test_id", action: "set null" },
  { parent: "hackathons", child: "tasks", col: "hackathon_id", action: "set null" },
  { parent: "tasks", child: "side_quests", col: "task_id", action: "set null" },
  { parent: "categories", child: "tasks", col: "category_id", action: "restrict" },
];

const DEFAULTS: Partial<Record<TableName, Row>> = {
  tasks: { description: null, priority: "medium", status: "not_started", due_date: null, due_time: null, estimated_minutes: null, project_id: null, milestone_id: null, test_id: null, hackathon_id: null, link_url: null, email_reminder: "default", source: "manual", source_key: null, completed_at: null },
  projects: { description: null, objective: null, tech_stack: [], status: "planning", progress: 0, progress_mode: "manual", start_date: null, deadline: null, repo_url: null, demo_url: null, presentation_url: null, docs_url: null, video_url: null, blockers: null, notes: null, outcome: {} },
  project_milestones: { description: null, status: "pending", due_date: null, completed_at: null, sort_order: 0 },
  tests: { test_time: null, prep_status: "not_started", syllabus: null, notes: null },
  hackathons: { description: null, start_date: null, end_date: null, registration_deadline: null, submission_deadline: null, submission_time: null, status: "registered", team_name: null, team_members: null, repo_url: null, demo_url: null, presentation_url: null, submission_url: null, canva_url: null, project_description: null, milestones: null, brain_dump: null, results: null, achievements: null, retrospective: null, final_demo_url: null, certificate_url: null, completed_at: null, completion_count: 0 },
  resources: { subject: null, url: null, storage_path: null, file_name: null, mime_type: null, size_bytes: null, description: null, entity_type: null, entity_id: null, section: null },
  learning_topics: { source_url: null, further_reading: [], provider: null, model: null, is_read: false, is_saved: false },
  side_quests: { estimated_minutes: 60, status: "suggested", source: "ai", task_id: null, started_at: null, completed_at: null },
  reminders: { event_time: null, offset_days: 0, priority: "medium", category_slug: null, in_app_state: "active", email_status: "pending", email_attempts: 0, next_attempt_at: null, sent_at: null, last_error: null, provider_message_id: null },
  github_snapshots: { data: null, synced_at: null, last_error: null, last_error_at: null },
  profiles: { preferences: {}, reminder_prefs: {} },
  categories: { icon: null, sort_order: 0 },
};

const HAS_UPDATED_AT = new Set<TableName>(["profiles", "projects", "project_milestones", "tests", "hackathons", "tasks", "reminders", "github_snapshots"]);

// One queue per process so concurrent server actions never interleave writes.
const g = globalThis as unknown as { __divaQueue?: Promise<unknown>; __divaCache?: Store | null };
g.__divaQueue ??= Promise.resolve();

async function load(): Promise<Store> {
  if (g.__divaCache) return g.__divaCache;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Store;
    for (const t of TABLES) parsed[t] ??= [];
    g.__divaCache = parsed;
  } catch {
    const empty: Store = {};
    for (const t of TABLES) empty[t] = [];
    g.__divaCache = empty;
  }
  return g.__divaCache!;
}

async function persist(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 1));
  await fs.rename(tmp, DB_FILE);
}

function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = g.__divaQueue!.then(fn, fn);
  g.__divaQueue = run.catch(() => undefined);
  return run;
}

function matches(row: Row, f?: Filter) {
  if (!f) return true;
  for (const [k, v] of Object.entries(f.eq ?? {})) if ((row[k] ?? null) !== v) return false;
  for (const [k, v] of Object.entries(f.in ?? {})) if (!v.includes(row[k])) return false;
  for (const [k, v] of Object.entries(f.lte ?? {})) if (row[k] == null || String(row[k]) > String(v)) return false;
  for (const [k, v] of Object.entries(f.gte ?? {})) if (row[k] == null || String(row[k]) < String(v)) return false;
  return true;
}

function checkUnique(store: Store, table: TableName, row: Row, ignore?: Row) {
  for (const u of UNIQUE[table] ?? []) {
    if (u.when && !u.when(row)) continue;
    const clash = store[table].find(
      (r) => r !== ignore && (!u.when || u.when(r)) && u.cols.every((c) => (r[c] ?? null) === (row[c] ?? null)),
    );
    if (clash) throw new DbError(`duplicate key on ${table}(${u.cols.join(",")})`, "unique");
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function localDb(): Db {
  return {
    async select<T>(table: TableName, filter?: Filter, opts?: SelectOptions) {
      const store = await load();
      let rows = store[table].filter((r) => matches(r, filter));
      for (const o of [...(opts?.order ?? [])].reverse()) {
        rows = [...rows].sort((a, b) => {
          const av = a[o.column], bv = b[o.column];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const c = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
          return o.ascending === false ? -c : c;
        });
      }
      if (opts?.limit) rows = rows.slice(0, opts.limit);
      return clone(rows) as T[];
    },

    insert<T>(table: TableName, input: Row | Row[]) {
      return exclusive(async () => {
        const store = await load();
        const now = new Date().toISOString();
        const list = Array.isArray(input) ? input : [input];
        const created: Row[] = [];
        for (const r of list) {
          const row: Row = { ...(DEFAULTS[table] ?? {}), created_at: now, ...r };
          if (!PK[table]) row.id ??= randomUUID();
          if (HAS_UPDATED_AT.has(table)) row.updated_at = now;
          checkUnique(store, table, row);
          checkUnique({ [table]: created } as Store, table, row);
          created.push(row);
        }
        store[table].push(...created);
        await persist(store);
        return clone(created) as T[];
      });
    },

    update<T>(table: TableName, filter: Filter, patch: Row) {
      return exclusive(async () => {
        const store = await load();
        const now = new Date().toISOString();
        const out: Row[] = [];
        for (const row of store[table]) {
          if (!matches(row, filter)) continue;
          const next = { ...row, ...patch, ...(HAS_UPDATED_AT.has(table) ? { updated_at: now } : {}) };
          checkUnique(store, table, next, row);
          Object.assign(row, next);
          out.push(row);
        }
        if (out.length) await persist(store);
        return clone(out) as T[];
      });
    },

    remove(table: TableName, filter: Filter) {
      return exclusive(async () => {
        const store = await load();
        const doomed = store[table].filter((r) => matches(r, filter));
        if (!doomed.length) return 0;
        const cascade = (parent: TableName, rows: Row[]) => {
          const pkCol = PK[parent] ?? "id";
          const ids = new Set(rows.map((r) => r[pkCol]));
          for (const fk of FK.filter((x) => x.parent === parent)) {
            const kids = store[fk.child].filter((r) => ids.has(r[fk.col] as string));
            if (!kids.length) continue;
            if (fk.action === "restrict") throw new DbError(`${parent} is still referenced by ${fk.child}`, "fk");
            if (fk.action === "set null") kids.forEach((k) => (k[fk.col] = null));
            if (fk.action === "cascade") {
              cascade(fk.child, kids);
              store[fk.child] = store[fk.child].filter((r) => !kids.includes(r));
            }
          }
        };
        cascade(table, doomed);
        store[table] = store[table].filter((r) => !doomed.includes(r));
        await persist(store);
        return doomed.length;
      });
    },
  };
}

export function localFiles(): FileStore {
  const safe = (p: string) => {
    const full = path.join(UPLOAD_DIR, p);
    if (!full.startsWith(UPLOAD_DIR)) throw new Error("Invalid path");
    return full;
  };
  return {
    async upload(p, bytes) {
      const full = safe(p);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, Buffer.from(bytes));
    },
    async signedUrl() {
      return null;
    },
    async read(p) {
      try {
        return await fs.readFile(safe(p));
      } catch {
        return null;
      }
    },
    async remove(paths) {
      await Promise.all(paths.map((p) => fs.rm(safe(p), { force: true })));
    },
  };
}

export async function resetLocalStore() {
  return exclusive(async () => {
    g.__divaCache = null;
    await fs.rm(DB_FILE, { force: true });
  });
}
