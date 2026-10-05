"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { FolderKanban, GraduationCap, ListChecks, Paperclip, Search, Trophy } from "lucide-react";
import { searchAction } from "@/app/actions/misc";
import type { SearchHit } from "@/lib/services/search";
import { Spinner } from "@/components/ui/bits";
import { NAV } from "./nav";

const ICONS = { task: ListChecks, test: GraduationCap, project: FolderKanban, hackathon: Trophy, resource: Paperclip };

export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(
      () =>
        start(async () => {
          const r = await searchAction(q);
          if (r.ok) {
            setHits(r.data);
            setError(null);
          } else setError(r.error);
        }),
      180,
    );
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl" aria-describedby={undefined}>
          <D.Title className="sr-only">Search Diva</D.Title>
          <Command shouldFilter={false} label="Search">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-subtle" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search tasks, tests, projects, hackathons, materials…" className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-subtle" />
              {pending && <Spinner />}
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <Command.Group heading="Jump to" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle">
                  {NAV.map((n) => (
                    <Command.Item key={n.href} onSelect={() => go(n.href)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-3">
                      <n.icon className="size-4 text-subtle" />
                      {n.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : (
                <>
                  {error && <p className="px-2 py-6 text-center text-sm text-danger">{error}</p>}
                  {!pending && !error && <Command.Empty className="px-2 py-6 text-center text-sm text-muted">No matches for “{q}”.</Command.Empty>}
                  {hits.map((h) => {
                    const Icon = ICONS[h.type];
                    return (
                      <Command.Item key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}`} onSelect={() => go(h.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 data-[selected=true]:bg-surface-3">
                        <Icon className="size-4 shrink-0 text-subtle" />
                        <div className="min-w-0">
                          <p className="truncate text-sm">{h.title}</p>
                          <p className="truncate text-2xs capitalize text-subtle">{h.subtitle}</p>
                        </div>
                      </Command.Item>
                    );
                  })}
                </>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
