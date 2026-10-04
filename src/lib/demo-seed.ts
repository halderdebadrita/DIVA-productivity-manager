import "server-only";
import { catBySlug, type Ctx } from "./context";
import { addDays, todayIn } from "./dates";
import { updateHackathon } from "./services/hackathons";
import { createMilestone, createProject, updateMilestone } from "./services/projects";
import { createLinkResource } from "./services/resources";
import { createTask } from "./services/tasks";
import { createTest } from "./services/tests";
import { createHackathon } from "./services/hackathons";
import type { TaskInput } from "./validation";

/** Sample data for demo mode only. Never runs when Supabase is configured. */
export async function seedDemo(ctx: Ctx) {
  const today = todayIn(ctx.tz);
  const d = (n: number) => addDays(today, n);
  const cat = (slug: string) => catBySlug(ctx, slug).id;

  const dbms = await createTest(ctx, { name: "DBMS Mid-Semester", subject: "Database Systems", type: "theory", test_date: d(6), test_time: "10:00", prep_status: "studying", syllabus: "ER model, normalisation (1NF–BCNF), SQL joins, transactions & ACID", notes: "Prof. said 2 questions on normalisation." });
  const osLab = await createTest(ctx, { name: "OS Lab Practical", subject: "Operating Systems", type: "practical", test_date: d(2), test_time: "14:00", prep_status: "revision", syllabus: "Fork/exec, pipes, scheduling simulation, semaphores", notes: null });
  await createTest(ctx, { name: "Discrete Maths Quiz 2", subject: "Discrete Mathematics", type: "theory", test_date: d(15), test_time: null, prep_status: "not_started", syllabus: "Graph theory, trees, recurrence relations", notes: null });
  await createTest(ctx, { name: "CN Quiz 1", subject: "Computer Networks", type: "theory", test_date: d(-9), test_time: "09:00", prep_status: "prepared", syllabus: "OSI vs TCP/IP, subnetting", notes: null });

  const diva = await createProject(ctx, {
    name: "Diva",
    description: "Personal productivity command centre — tasks, tests, hackathons and projects in one place.",
    objective: "Answer 'what should I do today?' in under five seconds every morning.",
    tech_stack: ["Next.js", "TypeScript", "Supabase", "Tailwind"],
    status: "in_progress",
    progress: 0,
    progress_mode: "milestones",
    start_date: d(-20),
    deadline: d(18),
    repo_url: null,
  });
  const m1 = await createMilestone(ctx, diva.id, { title: "Unified task system", description: null, due_date: d(-6) });
  await updateMilestone(ctx, m1.id, { status: "done" });
  const m2 = await createMilestone(ctx, diva.id, { title: "Dashboard + calendar", description: null, due_date: d(4) });
  await createMilestone(ctx, diva.id, { title: "Email reminders live", description: null, due_date: d(12) });

  const ml = await createProject(ctx, {
    name: "Plant Disease Classifier",
    description: "CNN that classifies leaf diseases from phone photos.",
    objective: "Reach 90% validation accuracy and ship a small web demo.",
    tech_stack: ["Python", "PyTorch", "FastAPI"],
    status: "paused",
    progress: 55,
    progress_mode: "manual",
    deadline: null,
    repo_url: "https://github.com/octocat/Hello-World",
  });
  await createProject(ctx, { name: "Portfolio v2", description: "Rebuild of my personal site with case studies.", tech_stack: ["Astro"], status: "planning", progress: 10, progress_mode: "manual", objective: null });
  await createProject(ctx, { name: "Campus Event Bot", description: "Telegram bot that posts campus events.", tech_stack: ["Node.js", "Telegram API"], status: "completed", progress: 100, progress_mode: "manual", objective: null, outcome: { summary: "Used by 300+ students in the first month.", key_features: "Daily digest, RSVP reminders", accomplishments: "Featured in the college newsletter" } });

  const hack = await createHackathon(ctx, { name: "Smart India Hackathon — Internal Round", description: "College-level selection round for SIH.", start_date: d(9), end_date: d(10), registration_deadline: d(3), submission_deadline: d(8), submission_time: "23:59", status: "preparing", team_name: "Null Pointers", team_members: "Debadrita, Arjun, Meera, Kabir" });
  await createLinkResource(ctx, { title: "Problem statement PDF", kind: "problem_statement", url: "https://www.sih.gov.in/", entity_type: "hackathon", entity_id: hack.id, section: "resources" });
  await ctx.db.update("hackathons", { eq: { id: hack.id } }, {
    brain_dump: "Idea shortlist:\n1. Offline-first crop advisory with SMS fallback\n2. Hostel complaint tracker with SLA alerts\n\nDecision pending: go with #1 if we can get a dataset by Friday.",
  });
  const past = await createHackathon(ctx, { name: "HackFest 2026", description: "36-hour open innovation hackathon.", start_date: d(-5), end_date: d(-4), submission_deadline: d(-4), status: "submitted", team_name: "Null Pointers" });
  // Marking it Completed runs the real follow-up workflow (task due in 3 days).
  await updateHackathon(ctx, past.id, { status: "completed", results: "Top 10 finish out of 80 teams" });

  const base: Omit<TaskInput, "title" | "category_id"> = { description: null, priority: "medium", status: "not_started", due_date: null, due_time: null, estimated_minutes: null, project_id: null, milestone_id: null, test_id: null, hackathon_id: null, link_url: null, email_reminder: "default" };
  const tasks: (Partial<TaskInput> & { title: string; category_id: string })[] = [
    { title: "Submit DAA assignment 3 (greedy algorithms)", category_id: cat("academics"), priority: "high", due_date: d(0), due_time: "17:00" },
    { title: "Revise semaphores for OS practical", category_id: cat("tests"), priority: "urgent", due_date: d(0), test_id: osLab.id, estimated_minutes: 60 },
    { title: "Wire calendar to real data", category_id: cat("projects"), priority: "medium", due_date: d(0), project_id: diva.id, milestone_id: m2.id, status: "in_progress" },
    { title: "Water the plants", category_id: cat("personal"), priority: "low", due_date: d(0) },
    { title: "Lab record: experiments 4–6", category_id: cat("academics"), priority: "high", due_date: d(-2) },
    { title: "Normalisation practice set", category_id: cat("tests"), priority: "medium", due_date: d(3), test_id: dbms.id },
    { title: "Finalise SIH idea and dataset", category_id: cat("hackathons"), priority: "high", due_date: d(3), hackathon_id: hack.id },
    { title: "Watch 3Blue1Brown: neural networks ch. 3", category_id: cat("learning"), priority: "low", due_date: d(5), link_url: "https://www.3blue1brown.com/topics/neural-networks" },
    { title: "Pay hostel mess fees", category_id: cat("personal"), priority: "high", due_date: d(7) },
    { title: "Write README for Diva", category_id: cat("projects"), priority: "low", due_date: d(11), project_id: diva.id },
    { title: "Retrain classifier with augmented data", category_id: cat("projects"), priority: "medium", project_id: ml.id },
    { title: "Read 'Designing Data-Intensive Applications' ch. 5", category_id: cat("learning"), priority: "low" },
    { title: "Book train tickets for Durga Puja", category_id: cat("personal"), priority: "medium", due_date: d(1) },
    { title: "Submit DBMS assignment 2", category_id: cat("academics"), priority: "medium", due_date: d(-4), status: "done" },
  ];
  for (const t of tasks) await createTask(ctx, { ...base, ...t } as TaskInput);

  await createLinkResource(ctx, { title: "DBMS unit 3 notes (Drive)", kind: "notes", subject: "Database Systems", url: "https://drive.google.com/", entity_type: "study", entity_id: null, description: "Shared class notes", section: null });
  await createLinkResource(ctx, { title: "Normalisation PYQs 2019–2025", kind: "pyq", subject: "Database Systems", url: "https://example.com/pyqs", entity_type: "test", entity_id: dbms.id, description: null, section: null });
  await createLinkResource(ctx, { title: "OSTEP — Operating Systems: Three Easy Pieces", kind: "link", subject: "Operating Systems", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/", entity_type: "test", entity_id: osLab.id, description: "Free textbook", section: null });
}
