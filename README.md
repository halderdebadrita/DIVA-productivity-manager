# Diva — personal productivity command centre (V0)

Diva answers four questions every time you open it: **what do I need to do today, what's coming up, where do my projects and commitments stand, and what productive thing can I do next?**

Built with Next.js 15 (App Router) · TypeScript · Tailwind · Radix/shadcn-style components · Lucide · Recharts · Supabase (Auth, Postgres, Storage) · Anthropic/OpenAI API · Resend.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

With no `.env.local`, Diva runs in **demo mode**: realistic sample data stored in `.diva-data/` (git-ignored, separate from any real account). Everything works: tasks, calendar, tests, hackathons, projects, file uploads and reminders. Integrations that aren't configured (AI, email) show a clearly labelled "not configured" state and fallback content. Nothing is faked.

To reset demo data: **Settings → Integrations → Reset demo data**.

## Everyday features

- **Tell Diva** (round button, bottom-right, or Ctrl+J): type what you need to do in plain words. The AI turns it into dated, categorised tasks and tests, linked to your existing tests, projects and hackathons. You review and edit everything before it's saved.
- **Quick links** (grid icon in the top bar, edit them in Settings → Quick links): your GitHub, Claude, Claude Code, ChatGPT, Gemini, NotebookLM, notes folder, college portal, hackathon platform, Canva and LinkedIn. They open in your normal browser, using the accounts you're already signed in to.
- **GitHub-powered projects**: Projects → *Import from GitHub* lists your repos (public ones via your GitHub link in Quick links; private too if `GITHUB_TOKEN` is set). Each imported repo is analysed by AI from its README, file tree, dependencies, commits and issues. Diva saves a description, objective, tech stack, an estimated % complete (from the project's own goals, never commit counts), and done/remaining lists you can turn into milestones. When you push new commits, Diva re-analyses on your next visit or scheduled run. Your own edits to the description are never overwritten.
- **Clear all data**: Settings → Your data. New installs start empty; set `DIVA_DEMO_SEED=1` to load sample data instead.

## Going live (your real data)

1. **Supabase**: create a project. In the SQL editor, run `supabase/schema.sql`. It creates the tables, Row Level Security policies, the new-user bootstrap trigger and the private `diva-files` storage bucket.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **AI**: set `ANTHROPIC_API_KEY`. The default model is `claude-sonnet-5-5`; override it with `AI_MODEL`. To use OpenAI instead, set `AI_PROVIDER=openai` and `OPENAI_API_KEY`.
4. **Email**: create a [Resend](https://resend.com) API key and verify a sending domain. Then set `RESEND_API_KEY` and `EMAIL_FROM`.
5. **Scheduler**: set `CRON_SECRET`, then pick one of these:
   - **GitHub Actions** (free, every 30 min): `.github/workflows/reminders.yml`. Add the repo secrets `DIVA_URL` and `CRON_SECRET`.
   - **Supabase pg_cron**: edit and run `supabase/cron.sql`.
   - **Vercel Cron**: `vercel.json` is included. The Hobby plan only allows daily crons, so use Pro or one of the options above for timely reminders.
   - **Manually**: run `npm run reminders`, or use **Settings → Email delivery → Process due now**.
6. Set `APP_URL` to your deployed URL so links in emails point to Diva.
7. Restart, open `/login` and create your account. Your timezone is set in Settings (default Asia/Kolkata).

## Architecture

```
src/
  app/                    routes (App Router)
    (app)/                authenticated shell: dashboard, tasks, tests(+materials), hackathons/[id], projects/[id], hangouts, learning, settings
    actions/              server actions (validated with zod) — tasks.ts, entities.ts, misc.ts
    api/cron/reminders    scheduled reminder job (Bearer CRON_SECRET)
    api/files/[id]        opens private files (signed URL / local stream)
    login, auth/callback  Supabase auth
  components/             ui/ (button, dialog, form, badges…), shell/, dashboard/, tasks/, tests/, hackathons/, projects/, resources/, settings/
  lib/
    db/                   Db interface + Supabase and local-file (demo) implementations
    services/             business logic: tasks, reminders, dispatch, hackathons, projects, tests, learning, side-quests, github, agenda, search
    integrations/         ai.ts (provider-agnostic, schema-validated), email.ts (Resend), github.ts
    context.ts            resolves the signed-in user (or demo user) per request
supabase/schema.sql       tables, constraints, RLS, storage
```

All secrets are read in `lib/env.ts` (`server-only`). Nothing secret reaches the browser.

### Data model

`profiles` (timezone, reminder prefs) · `categories` (one colour each, reused everywhere) · **`tasks`** (the single shared task table; optional links to `projects`, `project_milestones`, `tests`, `hackathons`; `source` + unique `source_key` for generated tasks) · `projects` → `project_milestones` · `tests` · `hackathons` · `resources` (links or private files attached to a test, hackathon, project, or general study material) · `learning_topics` (unique per user per day) · `side_quests` · **`reminders`** (one row per item per reminder day; drives both the dashboard panel and email; unique `idempotency_key`) · `github_snapshots` (GitHub data, stored separately from your own project fields).

Deadlines and progress are separate fields. Project progress is either manual or the share of completed milestones. It's never derived from dates or commit counts.

### Key rules

- **One task record everywhere.** The dashboard, calendar, monthly list, Tasks views, project and hackathon workspaces all read the same rows. Completing a task anywhere updates them all.
- **Reminders.** Every dated open item gets a day-of in-app reminder, plus email reminders N days before (configurable per type in Settings). Completing, rescheduling or deleting an item cancels its unsent emails. Reopening re-activates its future reminders.
- **Email delivery** is driven only by the scheduler. Each email moves `pending → sending → sent | failed`. It's claimed atomically, so parallel runs can't double-send, and the provider gets the same idempotency key. Transient failures retry with backoff (5/15/45 min, max 4 attempts). Failed emails can also be retried from Settings. Without email credentials, reminders stay `pending` and the UI says email isn't configured.
- **Hackathon certificate follow-up.** The first time a hackathon is marked Completed, Diva creates *"Upload hackathon certificate to LinkedIn — [name]"*, due 3 calendar days later in your timezone and linked to the hackathon. A unique `source_key` makes this idempotent. Reopening and completing again does **not** create a second follow-up. If you deleted the follow-up task, completing again recreates it.
- **Daily learning.** Diva generates one topic per calendar day in your timezone and stores it. Refreshes reuse it. Previous titles are passed to the model and checked for overlap. If generation fails, Diva shows your latest topic or a clearly labelled offline topic. Fallback content is never stored as "today's topic".
- **Deletion policy.** Deleting a project, test or hackathon removes its own resources and files, milestones and GitHub snapshot, and keeps linked tasks (unlinked). Every deletion asks for confirmation.

## Verified locally (demo mode + mock providers)

- Create, edit, complete, reopen and delete tasks; tasks sync across the dashboard, calendar, monthly list and Tasks views; data persists across refresh.
- Tests show on the calendar; preparation status is independent of the date.
- Completing a hackathon twice (with a reopen in between) creates exactly one follow-up, due +3 days.
- Reminder job: unauthenticated requests get 401. Three concurrent runs sent each due email exactly once. A provider 503 was recorded as failed with backoff and later retried successfully under the same idempotency key.
- AI (mock Anthropic endpoint): invalid output was rejected and retried, the topic was stored once, refreshes didn't regenerate it, and side quests came from the AI.
- GitHub failure path: the error is shown with Retry, and project fields are untouched.
- Mobile (390 px): no horizontal overflow on any page.

**Not verified here:** a live Supabase project, real Resend delivery, real Anthropic responses, and live GitHub sync. The sandbox can't reach those services or has no credentials for them. These paths are implemented against the official APIs, but you should check each one once with your own keys.
