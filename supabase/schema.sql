-- ============================================================================
-- Diva — Version 0 schema
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- Every user-owned table has Row Level Security: a user can only see their rows.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default 'there',
  email          text,
  timezone       text not null default 'Asia/Kolkata',
  preferences    jsonb not null default '{}'::jsonb,
  reminder_prefs jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categories (one colour per category, reused everywhere)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slug        text not null,
  name        text not null,
  color       text not null,
  icon        text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, slug)
);

-- ---------------------------------------------------------------------------
-- Projects + milestones
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  objective        text,
  tech_stack       text[] not null default '{}',
  status           text not null default 'planning'
                   check (status in ('planning','in_progress','paused','completed')),
  progress         int  not null default 0 check (progress between 0 and 100),
  progress_mode    text not null default 'manual' check (progress_mode in ('manual','milestones','github')),
  start_date       date,
  deadline         date,
  repo_url         text,
  demo_url         text,
  presentation_url text,
  docs_url         text,
  video_url        text,
  blockers         text,
  notes            text,
  outcome          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id);

create table if not exists public.project_milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'pending' check (status in ('pending','done')),
  due_date     date,
  completed_at timestamptz,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists milestones_project_idx on public.project_milestones(project_id);

-- ---------------------------------------------------------------------------
-- Tests
-- ---------------------------------------------------------------------------
create table if not exists public.tests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  subject     text not null,
  type        text not null check (type in ('theory','practical')),
  test_date   date not null,
  test_time   text,                         -- 'HH:mm' in the user's timezone
  prep_status text not null default 'not_started'
              check (prep_status in ('not_started','studying','revision','prepared')),
  syllabus    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tests_user_date_idx on public.tests(user_id, test_date);

-- ---------------------------------------------------------------------------
-- Hackathons
-- ---------------------------------------------------------------------------
create table if not exists public.hackathons (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  description           text,
  start_date            date,
  end_date              date,
  registration_deadline date,
  submission_deadline   date,
  submission_time       text,
  status                text not null default 'registered'
                        check (status in ('registered','preparing','in_progress','submitted','completed')),
  team_name             text,
  team_members          text,
  repo_url              text,
  demo_url              text,
  presentation_url      text,
  submission_url        text,
  canva_url             text,
  project_description   text,
  milestones            text,
  brain_dump            text,
  results               text,
  achievements          text,
  retrospective         text,
  final_demo_url        text,
  certificate_url       text,
  completed_at          timestamptz,
  completion_count      int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists hackathons_user_idx on public.hackathons(user_id);

-- ---------------------------------------------------------------------------
-- Tasks — the single, shared task table
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  description       text,
  category_id       uuid not null references public.categories(id) on delete restrict,
  priority          text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status            text not null default 'not_started' check (status in ('not_started','in_progress','done')),
  due_date          date,
  due_time          text,                   -- 'HH:mm' in the user's timezone
  estimated_minutes int,
  project_id        uuid references public.projects(id) on delete set null,
  milestone_id      uuid references public.project_milestones(id) on delete set null,
  test_id           uuid references public.tests(id) on delete set null,
  hackathon_id      uuid references public.hackathons(id) on delete set null,
  link_url          text,
  email_reminder    text not null default 'default' check (email_reminder in ('default','off')),
  source            text not null default 'manual'
                    check (source in ('manual','side_quest','hackathon_followup','milestone')),
  source_key        text,                   -- idempotency key for generated tasks
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create unique index if not exists tasks_source_key_uidx on public.tasks(user_id, source_key) where source_key is not null;

-- ---------------------------------------------------------------------------
-- Resources & attachments (files live in the private `diva-files` bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  kind         text not null,
  subject      text,
  url          text,
  storage_path text,
  file_name    text,
  mime_type    text,
  size_bytes   bigint,
  description  text,
  entity_type  text check (entity_type in ('test','hackathon','project','study')),
  entity_id    uuid,
  section      text,
  created_at   timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);
create index if not exists resources_entity_idx on public.resources(user_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Diva Keeps Learning
-- ---------------------------------------------------------------------------
create table if not exists public.learning_topics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  category        text not null,
  content         text not null,
  key_takeaway    text not null,
  source_url      text,
  further_reading jsonb not null default '[]'::jsonb,
  generated_for   date not null,
  provider        text,
  model           text,
  is_read         boolean not null default false,
  is_saved        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, generated_for)
);

-- ---------------------------------------------------------------------------
-- Side quests
-- ---------------------------------------------------------------------------
create table if not exists public.side_quests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  title                text not null,
  description          text not null,
  category             text not null,
  estimated_minutes    int not null default 60,
  completion_criterion text not null,
  status               text not null default 'suggested'
                       check (status in ('suggested','active','completed','skipped')),
  source               text not null default 'ai' check (source in ('ai','fallback')),
  task_id              uuid references public.tasks(id) on delete set null,
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reminders — one record drives BOTH the dashboard panel and the email
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  entity_type     text not null check (entity_type in ('task','test','project','milestone','hackathon')),
  entity_id       uuid not null,
  reminder_type   text not null,
  title           text not null,
  event_date      date not null,
  event_time      text,
  offset_days     int not null default 0,
  remind_at       timestamptz not null,
  timezone        text not null,
  priority        text not null default 'medium',
  category_slug   text,
  in_app_state    text not null default 'active' check (in_app_state in ('active','acknowledged','resolved')),
  email_status    text not null default 'pending'
                  check (email_status in ('pending','sending','sent','failed','cancelled','skipped')),
  email_attempts  int not null default 0,
  next_attempt_at timestamptz,
  sent_at         timestamptz,
  last_error      text,
  provider_message_id text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders(email_status, remind_at);
create index if not exists reminders_entity_idx on public.reminders(user_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Integration records (GitHub sync metadata — never credentials)
-- ---------------------------------------------------------------------------
create table if not exists public.github_snapshots (
  project_id     uuid primary key references public.projects(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  repo_full_name text not null,
  data           jsonb,
  synced_at      timestamptz,
  last_error     text,
  last_error_at  timestamptz,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','project_milestones','tests','hackathons','tasks','reminders','github_snapshots']
  loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories','projects','project_milestones','tests','hackathons','tasks',
                           'resources','learning_topics','side_quests','reminders','github_snapshots']
  loop
    execute format('alter table public.%s enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%s', t);
    execute format('create policy "own rows" on public.%s for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + default categories
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(split_part(new.email, '@', 1), 'there'))
  on conflict (id) do nothing;

  insert into public.categories (user_id, slug, name, color, sort_order) values
    (new.id, 'academics',  'Academics',     '#7AA7FF', 1),
    (new.id, 'tests',      'Tests & Exams', '#FFB347', 2),
    (new.id, 'projects',   'Projects',      '#B794FF', 3),
    (new.id, 'hackathons', 'Hackathons',    '#FF7EB6', 4),
    (new.id, 'personal',   'Personal',      '#4FD1A1', 5),
    (new.id, 'learning',   'Learning',      '#4CC9F0', 6),
    (new.id, 'other',      'Other',         '#A3A8B8', 7)
  on conflict (user_id, slug) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private storage bucket: files are stored under <user_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('diva-files', 'diva-files', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "diva own files read" on storage.objects;
drop policy if exists "diva own files write" on storage.objects;
drop policy if exists "diva own files delete" on storage.objects;
create policy "diva own files read" on storage.objects for select
  using (bucket_id = 'diva-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "diva own files write" on storage.objects for insert
  with check (bucket_id = 'diva-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "diva own files delete" on storage.objects for delete
  using (bucket_id = 'diva-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Migration for existing databases (V0.2: GitHub-driven progress)
alter table public.projects drop constraint if exists projects_progress_mode_check;
alter table public.projects add constraint projects_progress_mode_check check (progress_mode in ('manual','milestones','github'));
