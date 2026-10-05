// Personal quick links. Each opens in your normal browser, so it uses whatever
// account you're already signed in to there. Override any URL in Settings → Quick links.

export interface QuickLinkDef {
  key: string;
  label: string;
  url: string;
  hint: string;
  where: string; // where the button shows up in Diva
  mark: string; // small letter badge (no third-party logos)
  color: string;
}

export const QUICK_LINK_DEFS: QuickLinkDef[] = [
  { key: "github", label: "GitHub", url: "https://github.com/", hint: "Tip: use your profile, e.g. https://github.com/<username>", where: "Projects", mark: "GH", color: "#8b949e" },
  { key: "claude", label: "Claude", url: "https://claude.ai/new", hint: "Opens a new chat in your Claude account", where: "Tests · AI shortcuts", mark: "C", color: "#D97757" },
  { key: "claude_code", label: "Claude Code", url: "https://claude.ai/code", hint: "Claude Code on the web (your account)", where: "Hackathons · Projects", mark: "CC", color: "#C96442" },
  { key: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/", hint: "Your ChatGPT account", where: "Tests · AI shortcuts", mark: "G", color: "#10A37F" },
  { key: "gemini", label: "Gemini", url: "https://gemini.google.com/app", hint: "Your Google account", where: "Tests · AI shortcuts", mark: "Ge", color: "#4C8DF6" },
  { key: "notebooklm", label: "NotebookLM", url: "https://notebooklm.google.com/", hint: "Your Google account", where: "Tests · AI shortcuts", mark: "N", color: "#4285F4" },
  { key: "study_drive", label: "Study notes folder", url: "https://drive.google.com/drive/my-drive", hint: "Paste your notes/PYQ folder link (Drive, OneDrive…)", where: "Tests · Study Material Helper", mark: "SD", color: "#F4B400" },
  { key: "college_portal", label: "College portal / LMS", url: "", hint: "Your college ERP, Moodle or Google Classroom link", where: "Tests · Study Material Helper", mark: "U", color: "#7AA7FF" },
  { key: "hackathon_platform", label: "Hackathon platform", url: "https://devfolio.co/", hint: "Devfolio, Unstop, Devpost… whichever you use", where: "Hackathons", mark: "HP", color: "#FF7EB6" },
  { key: "canva", label: "Canva", url: "https://www.canva.com/", hint: "Your Canva home", where: "Hackathons", mark: "Cv", color: "#00C4CC" },
  { key: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/feed/", hint: "Used by the certificate follow-up task", where: "Hackathon follow-ups", mark: "in", color: "#0A66C2" },
];

export type QuickLinks = Record<string, string>;

export function resolveQuickLinks(saved: unknown): (QuickLinkDef & { custom: boolean })[] {
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<string, string>;
  return QUICK_LINK_DEFS.map((d) => ({ ...d, url: typeof s[d.key] === "string" ? s[d.key] : d.url, custom: typeof s[d.key] === "string" && s[d.key] !== d.url }));
}
