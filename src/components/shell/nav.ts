import { FolderKanban, GraduationCap, LayoutDashboard, ListChecks, PartyPopper, Settings, Trophy } from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/tests", label: "Tests", icon: GraduationCap },
  { href: "/hackathons", label: "Hackathon", icon: Trophy },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/hangouts", label: "Hangouts", icon: PartyPopper },
];
export const SETTINGS = { href: "/settings", label: "Settings", icon: Settings };
