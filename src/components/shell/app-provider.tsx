"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Category, Task } from "@/lib/types";

export interface Lookups {
  categories: Category[];
  projects: { id: string; name: string; status: string }[];
  milestones: { id: string; title: string; project_id: string }[];
  tests: { id: string; name: string; subject: string; test_date: string }[];
  hackathons: { id: string; name: string; status: string }[];
}

export interface AppInfo {
  tz: string;
  today: string;
  displayName: string;
  email: string | null;
  mode: "supabase" | "demo";
  integrations: { ai: boolean; email: boolean; github: boolean; cron: boolean; supabase: boolean };
  links: Record<string, string>;
}

type TaskDraft = Partial<Pick<Task, "category_id" | "project_id" | "test_id" | "hackathon_id" | "milestone_id" | "due_date" | "priority" | "title">>;

interface Ctx extends Lookups, AppInfo {
  catById: (id: string) => Category;
  catBySlug: (slug: string) => Category;
  dialog: { open: boolean; task: Task | null; taskId: string | null; draft: TaskDraft | null };
  openTask: (task: Task | string) => void;
  newTask: (draft?: TaskDraft) => void;
  closeTask: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ lookups, info, children }: { lookups: Lookups; info: AppInfo; children: React.ReactNode }) {
  const [dialog, setDialog] = useState<Ctx["dialog"]>({ open: false, task: null, taskId: null, draft: null });
  const fallback = lookups.categories.find((c) => c.slug === "other") ?? lookups.categories[0];
  const catById = useCallback((id: string) => lookups.categories.find((c) => c.id === id) ?? fallback, [lookups.categories, fallback]);
  const catBySlug = useCallback((slug: string) => lookups.categories.find((c) => c.slug === slug) ?? fallback, [lookups.categories, fallback]);
  const value = useMemo<Ctx>(
    () => ({
      ...lookups,
      ...info,
      catById,
      catBySlug,
      dialog,
      openTask: (t) => setDialog(typeof t === "string" ? { open: true, task: null, taskId: t, draft: null } : { open: true, task: t, taskId: t.id, draft: null }),
      newTask: (draft) => setDialog({ open: true, task: null, taskId: null, draft: draft ?? {} }),
      closeTask: () => setDialog((d) => ({ ...d, open: false })),
    }),
    [lookups, info, catById, catBySlug, dialog],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
